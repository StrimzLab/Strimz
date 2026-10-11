// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

interface ISafe {
    function getThreshold() external view returns (uint256);
}

library AdminHandoff {
    struct Contracts {
        address registry;
        address tokenWhitelist;
        address feeCollector;
        address payments;
        address subscriptions;
        address agentRegistry;
        address agentEscrow;
    }

    struct Holders {
        address safe;
        address guardian;
        address relayer;
        address scheduler;
        address deployer;
    }

    struct Grant {
        address target;
        bytes32 role;
        address account;
    }

    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 internal constant ADMIN_ROLE = keccak256("STRIMZ_ADMIN_ROLE");
    bytes32 internal constant UPGRADER_ROLE = keccak256("STRIMZ_UPGRADER_ROLE");
    bytes32 internal constant CHARGER_ROLE = keccak256("STRIMZ_CHARGER_ROLE");
    bytes32 internal constant TOKEN_MANAGER_ROLE = keccak256("STRIMZ_TOKEN_MANAGER_ROLE");
    bytes32 internal constant MERCHANT_REGISTRAR_ROLE = keccak256("STRIMZ_MERCHANT_REGISTRAR_ROLE");
    bytes32 internal constant FEE_ACCRUER_ROLE = keccak256("STRIMZ_FEE_ACCRUER_ROLE");
    bytes32 internal constant TREASURY_ROLE = keccak256("STRIMZ_TREASURY_ROLE");
    bytes32 internal constant AGENT_ADMIN_ROLE = keccak256("STRIMZ_AGENT_ADMIN_ROLE");
    bytes32 internal constant PAUSER_ROLE = keccak256("STRIMZ_PAUSER_ROLE");
    bytes32 internal constant DISPUTE_RESOLVER_ROLE = keccak256("STRIMZ_DISPUTE_RESOLVER_ROLE");

    uint256 internal constant MIN_SAFE_THRESHOLD = 2;

    error AdminHandoff__ZeroAddress();
    error AdminHandoff__ZeroDelay();
    error AdminHandoff__SafeHasNoCode(address safe);
    error AdminHandoff__SafeThresholdTooLow(uint256 threshold);
    error AdminHandoff__HoldersNotDistinct();
    error AdminHandoff__DeployerNotAdmin(address target);
    error AdminHandoff__ServiceRoleAdminNotSet(address target);
    error AdminHandoff__RoleMismatch(address target, bytes32 role, address account, bool expected);

    function run(Contracts memory c, Holders memory h, uint256 minDelay)
        internal
        returns (TimelockController timelock)
    {
        check(c, h, minDelay);

        address[] memory proposers = new address[](1);
        proposers[0] = h.safe;
        address[] memory executors = new address[](1);
        timelock = new TimelockController(minDelay, proposers, executors, address(0));

        Grant[] memory table = roleTable(c, h, address(timelock));
        for (uint256 i; i < table.length; ++i) {
            IAccessControl target = IAccessControl(table[i].target);
            if (!target.hasRole(table[i].role, table[i].account)) {
                target.grantRole(table[i].role, table[i].account);
            }
        }

        renounceAll(c, h.deployer);
        verify(c, h, address(timelock), table);
    }

    function check(Contracts memory c, Holders memory h, uint256 minDelay) internal view {
        if (minDelay == 0) revert AdminHandoff__ZeroDelay();

        address[7] memory targets = _targets(c);
        for (uint256 i; i < targets.length; ++i) {
            if (targets[i] == address(0)) revert AdminHandoff__ZeroAddress();
        }
        if (h.safe == address(0) || h.relayer == address(0) || h.scheduler == address(0) || h.deployer == address(0))
        {
            revert AdminHandoff__ZeroAddress();
        }

        address[5] memory holders = [h.safe, h.relayer, h.scheduler, h.deployer, h.guardian];
        for (uint256 i; i < holders.length; ++i) {
            for (uint256 j = i + 1; j < holders.length; ++j) {
                if (holders[j] != address(0) && holders[i] == holders[j]) revert AdminHandoff__HoldersNotDistinct();
            }
        }

        if (h.safe.code.length == 0) revert AdminHandoff__SafeHasNoCode(h.safe);
        uint256 threshold = ISafe(h.safe).getThreshold();
        if (threshold < MIN_SAFE_THRESHOLD) revert AdminHandoff__SafeThresholdTooLow(threshold);

        for (uint256 i; i < targets.length; ++i) {
            if (!IAccessControl(targets[i]).hasRole(DEFAULT_ADMIN_ROLE, h.deployer)) {
                revert AdminHandoff__DeployerNotAdmin(targets[i]);
            }
        }

        _checkServiceRoleAdmins(c);
    }

    function roleTable(Contracts memory c, Holders memory h, address timelock)
        internal
        pure
        returns (Grant[] memory table)
    {
        table = new Grant[](h.guardian == address(0) ? 34 : 37);
        uint256 n;

        address[7] memory all = _targets(c);
        for (uint256 i; i < all.length; ++i) {
            n = _push(table, n, all[i], DEFAULT_ADMIN_ROLE, timelock);
        }

        address[5] memory upgradeable = [c.registry, c.tokenWhitelist, c.feeCollector, c.agentRegistry, c.agentEscrow];
        for (uint256 i; i < upgradeable.length; ++i) {
            n = _push(table, n, upgradeable[i], UPGRADER_ROLE, timelock);
        }

        n = _push(table, n, c.tokenWhitelist, TOKEN_MANAGER_ROLE, timelock);

        address[4] memory administered = [c.registry, c.payments, c.subscriptions, c.agentEscrow];
        for (uint256 i; i < administered.length; ++i) {
            n = _push(table, n, administered[i], ADMIN_ROLE, timelock);
            n = _push(table, n, administered[i], ADMIN_ROLE, h.safe);
        }

        address[3] memory pausable = [c.payments, c.subscriptions, c.agentEscrow];
        for (uint256 i; i < pausable.length; ++i) {
            n = _push(table, n, pausable[i], PAUSER_ROLE, timelock);
            n = _push(table, n, pausable[i], PAUSER_ROLE, h.safe);
            if (h.guardian != address(0)) n = _push(table, n, pausable[i], PAUSER_ROLE, h.guardian);
        }

        n = _push(table, n, c.feeCollector, TREASURY_ROLE, h.safe);
        n = _push(table, n, c.agentEscrow, DISPUTE_RESOLVER_ROLE, h.safe);
        n = _push(table, n, c.agentRegistry, AGENT_ADMIN_ROLE, h.safe);
        n = _push(table, n, c.registry, MERCHANT_REGISTRAR_ROLE, h.relayer);
        n = _push(table, n, c.subscriptions, CHARGER_ROLE, h.scheduler);
        n = _push(table, n, c.feeCollector, FEE_ACCRUER_ROLE, c.payments);
        n = _push(table, n, c.feeCollector, FEE_ACCRUER_ROLE, c.subscriptions);

        assert(n == table.length);
    }

    function renounceAll(Contracts memory c, address deployer) internal {
        address[7] memory targets = _targets(c);
        bytes32[11] memory roles = _roles();
        for (uint256 i; i < targets.length; ++i) {
            IAccessControl target = IAccessControl(targets[i]);
            for (uint256 j = 1; j < roles.length; ++j) {
                if (target.hasRole(roles[j], deployer)) target.renounceRole(roles[j], deployer);
            }
            target.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
        }
    }

    function verify(Contracts memory c, Holders memory h, address timelock, Grant[] memory table) internal view {
        address[7] memory targets = _targets(c);
        bytes32[11] memory roles = _roles();
        address[8] memory accounts =
            [timelock, h.safe, h.guardian, h.relayer, h.scheduler, h.deployer, c.payments, c.subscriptions];

        for (uint256 i; i < targets.length; ++i) {
            for (uint256 j; j < roles.length; ++j) {
                for (uint256 k; k < accounts.length; ++k) {
                    if (accounts[k] == address(0)) continue;
                    bool expected = _contains(table, targets[i], roles[j], accounts[k]);
                    if (IAccessControl(targets[i]).hasRole(roles[j], accounts[k]) != expected) {
                        revert AdminHandoff__RoleMismatch(targets[i], roles[j], accounts[k], expected);
                    }
                }
            }
        }

        _checkServiceRoleAdmins(c);
    }

    function _checkServiceRoleAdmins(Contracts memory c) private view {
        if (IAccessControl(c.registry).getRoleAdmin(MERCHANT_REGISTRAR_ROLE) != ADMIN_ROLE) {
            revert AdminHandoff__ServiceRoleAdminNotSet(c.registry);
        }
        if (IAccessControl(c.subscriptions).getRoleAdmin(CHARGER_ROLE) != ADMIN_ROLE) {
            revert AdminHandoff__ServiceRoleAdminNotSet(c.subscriptions);
        }
    }

    function _targets(Contracts memory c) private pure returns (address[7] memory) {
        return [c.registry, c.tokenWhitelist, c.feeCollector, c.payments, c.subscriptions, c.agentRegistry, c.agentEscrow];
    }

    function _roles() private pure returns (bytes32[11] memory) {
        return [
            DEFAULT_ADMIN_ROLE,
            ADMIN_ROLE,
            UPGRADER_ROLE,
            CHARGER_ROLE,
            TOKEN_MANAGER_ROLE,
            MERCHANT_REGISTRAR_ROLE,
            FEE_ACCRUER_ROLE,
            TREASURY_ROLE,
            AGENT_ADMIN_ROLE,
            PAUSER_ROLE,
            DISPUTE_RESOLVER_ROLE
        ];
    }

    function _push(Grant[] memory table, uint256 n, address target, bytes32 role, address account)
        private
        pure
        returns (uint256)
    {
        table[n] = Grant({ target: target, role: role, account: account });
        return n + 1;
    }

    function _contains(Grant[] memory table, address target, bytes32 role, address account)
        private
        pure
        returns (bool)
    {
        for (uint256 i; i < table.length; ++i) {
            if (table[i].target == target && table[i].role == role && table[i].account == account) return true;
        }
        return false;
    }
}
