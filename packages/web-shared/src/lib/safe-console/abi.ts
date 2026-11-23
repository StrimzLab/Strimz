import { parseAbi } from 'viem'

// Kept apart from apps/api's copy on purpose: the browser decodes what it signs by itself.
export const safeConsoleAbis = {
  safe: parseAbi([
    'function addOwnerWithThreshold(address owner, uint256 _threshold)',
    'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
    'function swapOwner(address prevOwner, address oldOwner, address newOwner)',
    'function changeThreshold(uint256 _threshold)',
  ]),
  pausable: parseAbi(['function pause()', 'function unpause()']),
  feeCollector: parseAbi(['function withdraw(address token, address to, uint256 amount)']),
  accessControl: parseAbi([
    'function grantRole(bytes32 role, address account)',
    'function revokeRole(bytes32 role, address account)',
  ]),
  timelock: parseAbi([
    'function schedule(address target, uint256 value, bytes data, bytes32 predecessor, bytes32 salt, uint256 delay)',
    'function execute(address target, uint256 value, bytes payload, bytes32 predecessor, bytes32 salt) payable',
    'function cancel(bytes32 id)',
  ]),
} as const
