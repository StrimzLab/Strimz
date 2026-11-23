import { parseAbi } from 'viem'

export const safeAbis = {
  safe: parseAbi([
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function nonce() view returns (uint256)',
    'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
    'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)',
    'function addOwnerWithThreshold(address owner, uint256 _threshold)',
    'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
    'function swapOwner(address prevOwner, address oldOwner, address newOwner)',
    'function changeThreshold(uint256 _threshold)',
  ]),
  pausable: parseAbi([
    'function pause()',
    'function unpause()',
    'function paused() view returns (bool)',
  ]),
  feeCollector: parseAbi(['function withdraw(address token, address to, uint256 amount)']),
  accessControl: parseAbi([
    'function grantRole(bytes32 role, address account)',
    'function revokeRole(bytes32 role, address account)',
  ]),
  timelock: parseAbi([
    'function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay)',
    'function execute(address target, uint256 value, bytes payload, bytes32 predecessor, bytes32 salt) payable',
    'function cancel(bytes32 id)',
    'function getMinDelay() view returns (uint256)',
    'function getTimestamp(bytes32 id) view returns (uint256)',
    'function hashOperation(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt) view returns (bytes32)',
  ]),
} as const
