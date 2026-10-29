# Runbook: AWS KMS keys for the relayer and the scheduler

Applies to the single Lightsail container (`strimz`, see `infra/lightsail/README.md`).
Background: [ADR-2026-10-11-aws-kms-signers](../adr/ADR-2026-10-11-aws-kms-signers.md).

The API relayer and the scheduler each sign with their own AWS KMS key. The private keys
never leave KMS. The server holds an access key for an IAM user that can only ask those
two keys to sign, and only from the Lightsail static IP. With `NODE_ENV=production`
neither service starts with a plaintext key.

| Service   | Key alias                          | Contract role                                        |
| --------- | ---------------------------------- | ---------------------------------------------------- |
| API       | `alias/strimz-<network>-relayer`   | `MERCHANT_REGISTRAR_ROLE`                            |
| Scheduler | `alias/strimz-<network>-scheduler` | `CHARGER_ROLE`, `CANCELLER_ROLE`, `FEE_MANAGER_ROLE` |

`<network>` is `testnet` or `mainnet`. Each network has its own two keys and its own
IAM user. The commands below use the AWS CLI and Foundry's `cast`.

```bash
NETWORK=testnet
REGION=us-east-1
LIGHTSAIL_IP=3.227.73.167
```

## 1. Create the two keys

```bash
for ROLE in relayer scheduler; do
  KEY_ID=$(aws kms create-key --region "$REGION" \
    --key-spec ECC_SECG_P256K1 --key-usage SIGN_VERIFY \
    --description "Strimz $NETWORK $ROLE signer" \
    --query KeyMetadata.KeyId --output text)
  aws kms create-alias --region "$REGION" \
    --alias-name "alias/strimz-$NETWORK-$ROLE" --target-key-id "$KEY_ID"
  echo "$ROLE key: $KEY_ID"
done
```

Each key costs $1 a month. Signing requests are billed per 10,000 with no free tier.

## 2. Read each key's address

```bash
for ROLE in relayer scheduler; do
  printf '%s: ' "$ROLE"
  aws kms get-public-key --region "$REGION" --key-id "alias/strimz-$NETWORK-$ROLE" \
    --query PublicKey --output text \
    | base64 --decode | tail -c 64 | xxd -p -c 64 \
    | xargs -I{} cast keccak 0x{} | cut -c27- \
    | xargs -I{} cast to-check-sum-address 0x{}
done
```

These are the values for `KMS_SIGNER_ADDRESS` (relayer) and `SCHEDULER_SIGNER_ADDRESS`
(scheduler). A service whose configured address differs from its key's address refuses
to start, and its error names the key's real address.

## 3. Create the IAM user

Write the key ARNs into a policy. Use the key ARNs, not the alias ARNs.

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
RELAYER_ARN=$(aws kms describe-key --region "$REGION" \
  --key-id "alias/strimz-$NETWORK-relayer" --query KeyMetadata.Arn --output text)
SCHEDULER_ARN=$(aws kms describe-key --region "$REGION" \
  --key-id "alias/strimz-$NETWORK-scheduler" --query KeyMetadata.Arn --output text)

cat > "strimz-$NETWORK-signer-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StrimzSignFromLightsailOnly",
      "Effect": "Allow",
      "Action": ["kms:Sign", "kms:GetPublicKey"],
      "Resource": ["$RELAYER_ARN", "$SCHEDULER_ARN"],
      "Condition": { "IpAddress": { "aws:SourceIp": "$LIGHTSAIL_IP/32" } }
    }
  ]
}
EOF

aws iam create-user --user-name "strimz-$NETWORK-signer"
aws iam put-user-policy --user-name "strimz-$NETWORK-signer" \
  --policy-name strimz-signer --policy-document "file://strimz-$NETWORK-signer-policy.json"
aws iam create-access-key --user-name "strimz-$NETWORK-signer"
```

The last command prints the access key once. It goes into the server `.env` only.

## 4. Fund the new addresses and grant their roles

Do this before switching the services, so the new keys can work from their first
transaction. Arc pays gas in native USDC (18 decimals), so `--value 5ether` sends 5 USDC.

```bash
cast send "$NEW_RELAYER" --value 5ether --private-key "$OLD_RELAYER_KEY" --rpc-url "$ARC_RPC_URL"
cast send "$NEW_SCHEDULER" --value 5ether --private-key "$OLD_SCHEDULER_KEY" --rpc-url "$ARC_RPC_URL"
```

Role ids:

```bash
REGISTRAR=$(cast keccak STRIMZ_MERCHANT_REGISTRAR_ROLE)
CHARGER=$(cast keccak STRIMZ_CHARGER_ROLE)
CANCELLER=$(cast keccak STRIMZ_CANCELLER_ROLE)
```

`CANCELLER_ROLE` exists only on the Subscriptions contract deployed with #142.

- **Before the admin handoff (#142):** the deployer still holds `ADMIN_ROLE` and grants
  directly.

  ```bash
  cast send "$REGISTRY" "grantRole(bytes32,address)" "$REGISTRAR" "$NEW_RELAYER" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$ARC_RPC_URL"
  cast send "$SUBSCRIPTIONS" "grantRole(bytes32,address)" "$CHARGER" "$NEW_SCHEDULER" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$ARC_RPC_URL"
  cast send "$SUBSCRIPTIONS" "grantRole(bytes32,address)" "$CANCELLER" "$NEW_SCHEDULER" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$ARC_RPC_URL"
  ```

- **After the handoff:** the Safe holds `ADMIN_ROLE`. Propose the same `grantRole`
  calls as a Safe transaction. Better still, run the handoff with the KMS addresses as
  `STRIMZ_RELAYER_ADDRESS` and `STRIMZ_SCHEDULER_ADDRESS`, so it grants them directly.

## 5. Switch the services

In the server `.env`:

```bash
KMS_PROVIDER=aws-kms
KMS_AWS_KEY_ID=alias/strimz-testnet-relayer
KMS_SIGNER_ADDRESS=<relayer address from section 2>
SCHEDULER_SIGNER_PROVIDER=aws-kms
SCHEDULER_KMS_KEY_ID=alias/strimz-testnet-scheduler
SCHEDULER_SIGNER_ADDRESS=<scheduler address from section 2>
RELAYER_ADDRESS=<relayer address from section 2>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from section 3>
AWS_SECRET_ACCESS_KEY=<from section 3>
```

Delete the `KMS_SOFTWARE_PRIVATE_KEY` and `SCHEDULER_PRIVATE_KEY` lines, or leave them
empty. A service refuses to start when a plaintext key is set next to a KMS key.

Redeploy, then check the boot logs:

```bash
docker logs strimz 2>&1 | grep -E 'signing with AWS KMS key|scheduler signing as'
```

## 6. Relay jobs caught mid-switch

A relay job that broadcast with the old relayer and had not settled at the switch fails
with `relay_signer_changed`, instead of reusing an old-address nonce on the new address.
Before the switch, a job recorded no sender at all, so the same applies to every job
that was mid-retry across this deploy.

For each failed job, look up its recorded `broadcast.txHash` on the explorer:

- mined: nothing to do, the payment or registration landed;
- not found: the transaction was dropped. Re-run the action from the dashboard or the
  hosted checkout.

## 7. Retire the old keys

Once the new keys have relayed a payment and charged a subscription:

```bash
cast send "$REGISTRY" "revokeRole(bytes32,address)" "$REGISTRAR" "$OLD_RELAYER" \
  --private-key "$DEPLOYER_KEY" --rpc-url "$ARC_RPC_URL"
cast send "$SUBSCRIPTIONS" "revokeRole(bytes32,address)" "$CHARGER" "$OLD_SCHEDULER" \
  --private-key "$DEPLOYER_KEY" --rpc-url "$ARC_RPC_URL"
```

After the handoff, these revocations go through the Safe as well. Then send the old
addresses' remaining USDC to the new ones and delete the old private keys from every
copy of the `.env` and from any backup.

## 8. Emergency stop and rotation

- **Stop all signing now:**
  `aws iam update-access-key --user-name strimz-$NETWORK-signer --access-key-id <id> --status Inactive`.
  Both services fail their next signature. `aws kms disable-key --key-id <key id>` stops
  one key.
- **Leaked access key:** create a new access key, update the `.env`, redeploy, then
  delete the old access key.
- **Rotate a signing key:** create a new key (section 1), then repeat sections 2, 4, 5
  and 7 for it. The address changes with the key.

## 9. Audit

Every signature is a `Sign` event in CloudTrail:

```bash
aws cloudtrail lookup-events --region "$REGION" \
  --lookup-attributes AttributeKey=EventName,AttributeValue=Sign --max-results 20
```

A `Sign` from any IP other than the Lightsail static IP is refused by the policy, and
CloudTrail records the refusal.
