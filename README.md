# LiteStream

Programmable native-zkLTC payment streams on LitVM LiteForge.

Built by **LiteLayer Labs** as a testnet MVP for programmable, time-based payments on LitVM.

## Live demo

- Frontend: https://jeffreygit888.github.io/litelayer-litestream/
- Network: LitVM LiteForge
- Chain ID: `4441`
- Contract: `0x2b4485Ab77068166acb158079F7Bb10fc5dd676A`

## What LiteStream does

A sender deposits native zkLTC into a stream. The recipient earns the deposit linearly between `startTime` and `endTime` and can withdraw only the vested portion.

If a stream is cancelable, the sender may cancel it. At cancellation:

- the recipient receives any vested amount not yet withdrawn;
- the sender receives only the unvested remainder;
- the stream is frozen at the cancellation timestamp.

Potential use cases include contractor payments, payroll, grants, creator payouts, founder/team vesting, subscriptions, and scheduled treasury payments.

## V1 features

- Native zkLTC deposits
- Linear vesting
- Recipient withdrawal of vested funds
- Optional sender cancellation
- Automatic vested payout + unvested refund on cancellation
- On-chain stream inspection
- Live vesting progress UI
- MetaMask wallet connection and account switching
- Test-wallet funding helper
- Dynamic EIP-1559 fee buffer for LiteForge
- Minimum transaction gas workaround for LiteForge native transfers
- Partial-cancel test helper

## Smart contract

Source: `contracts/LiteStream.sol`

Main functions:

```solidity
createStream(address recipient, uint64 startTime, uint64 endTime, bool cancelable)
withdraw(uint256 streamId)
cancelStream(uint256 streamId)
vestedAmount(uint256 streamId)
withdrawableAmount(uint256 streamId)
getStream(uint256 streamId)
```

The contract uses a simple non-reentrancy guard and follows effects-before-interactions for withdrawals and cancellation settlement.

## Testnet validation

The deployed MVP has been tested end-to-end with two MetaMask accounts on LitVM LiteForge.

| Test | Result |
|---|---|
| Create native zkLTC stream | Pass |
| Linear vesting inspection | Pass |
| Full recipient withdrawal after stream completion | Pass |
| Cancel before stream starts | Pass |
| Cancel after stream is fully vested | Pass |
| Cancel during partial vesting | Pass |
| Vested amount paid to recipient on cancellation | Pass |
| Unvested amount refunded to sender | Pass |
| Wallet account switching | Pass |
| Native zkLTC wallet funding helper | Pass |

### Selected transaction proofs

**Stream #1 — creation**

- Block: `44221302`
- Tx: `0x59debd18c4a843f722f806509ccde1071f01ca0541dd855aef0f14a599abdb32`
- Deposit: `0.001 zkLTC`

**Stream #1 — full withdrawal**

- Block: `44406064`
- Tx: `0x362f8599959cfc983ed6e672c5caab49eed9388b8a0ce7545e2c73ebec9e2405`
- Withdrawn: `0.001 zkLTC`

**Test-wallet native funding**

- Block: `44403658`
- Tx: `0x4765e4077e7b77d5ad5587cf03f7376844eab07d5726f375074318163820696e`
- Amount: `0.001 zkLTC`

**Stream #2 — cancel before start**

- Create block: `44406726`
- Create tx: `0xf955c395feb8647d333d818a6a47f638a96426c7cbca594cda847c822041cd92`
- Cancel block: `44406831`
- Cancel tx: `0x09e28ea5e6c779b56264cd4d327f82566e841f8b79f51562c06778f63eff21f7`
- Result: vested `0`, full unvested amount returned to sender

**Stream #3 — cancel after full vesting**

- Cancel block: `44425198`
- Cancel tx: `0xd8d6beecf5093f9c50bf7713e9b65b259a6130bdeb7a5d694448d9b8a382fbaf`
- Result: vested `0.001 zkLTC`, recipient receives full remaining deposit, sender refund `0`

**Stream #4 — partial-vesting cancellation**

Observed final state:

```text
Deposit:      0.001 zkLTC
Vested:       0.000455833333333333 zkLTC
Withdrawn:    0.000455833333333333 zkLTC
Withdrawable: 0
Canceled:     true
```

Therefore, at cancellation approximately:

```text
Recipient settlement: 0.000455833333333333 zkLTC
Sender refund:        0.000544166666666667 zkLTC
```

This validates the core partial-vesting settlement mechanism.

## LiteForge implementation notes

During testnet integration we found two practical network/RPC behaviours worth documenting.

### 1. Fee quote can fall below the next block base fee

A transaction may be rejected with an error similar to:

```text
max fee per gas less than block base fee
```

The frontend therefore reads the latest `baseFeePerGas` and applies an explicit fee buffer before submission.

### 2. Native transfer gas estimation can be lower than the accepted broadcast gas floor

A standard native transfer using a `21000` gas limit was rejected with:

```text
intrinsic gas too low
```

Even though RPC estimation returned roughly standard EVM transfer gas. The current frontend therefore applies a conservative minimum transaction gas limit of `100000` for LiteForge testnet interactions where necessary.

These are testnet integration observations, not assumptions about future LitVM mainnet behaviour.

## Current frontend workflow

1. Connect MetaMask on LitVM LiteForge.
2. Create a stream with recipient, amount, duration, and cancellation setting.
3. Inspect stream state and vesting progress.
4. Recipient switches wallet account and withdraws available vested funds.
5. Sender may cancel a cancelable stream.
6. Use the partial-cancel helper to observe a stream until a target vesting percentage is reached.

## Known limitations

- **Unaudited contract.** This is a testnet MVP and must not be used with meaningful real-world funds.
- **Frontend start-time buffer.** V1 currently schedules new streams roughly five minutes after the latest block timestamp to avoid testnet timestamp/race issues observed during early testing.
- **Recipient needs gas.** A recipient must already hold enough native zkLTC to submit a `withdraw()` transaction. Streamed funds cannot pay transaction gas before withdrawal under normal EVM transaction semantics.
- **No indexing/history layer.** The UI reads streams directly by ID; it does not yet provide account-based stream discovery or event history.
- **No gas sponsorship / account abstraction.** Relayers or sponsored withdrawals are not implemented.
- **Cancellation after end time remains callable.** If a stream is fully vested, cancellation settles the remaining vested amount to the recipient and refunds zero to the sender. A future version may disallow semantic cancellation after completion.
- **No formal security audit or fuzz/invariant test suite yet.**

## V2 roadmap

- Move stream start semantics closer to contract-side `block.timestamp` to reduce frontend timing assumptions
- Add event-indexed dashboard: incoming, outgoing, active, completed, canceled streams
- Add stream metadata / memo / payment reference
- Add batch and recurring payment primitives
- Add pause or configurable cancellation policies where appropriate
- Explore relayers, account abstraction, or gas-sponsored recipient withdrawals if supported by LitVM
- Add Solidity unit tests, fuzz tests, invariants, and static analysis
- Add better explorer links and transaction history UI
- Consider restricting cancellation to `block.timestamp < endTime`
- Security review before any production-value deployment

## Repository structure

```text
contracts/
  LiteStream.sol
frontend/
  index.html
  app.js
  style.css
docs/
  index.html
  app.js
  style.css
  wallet-switch.js
  test-helper.js
```

`docs/` is the GitHub Pages deployment.

## Deploy your own copy

1. Open Remix.
2. Create `LiteStream.sol` from `contracts/LiteStream.sol`.
3. Compile with Solidity `0.8.20` or compatible newer compiler.
4. Connect MetaMask to LitVM LiteForge.
5. Deploy with deployment value `0` and no constructor arguments.
6. Replace `CONTRACT_ADDRESS` in the frontend files with your deployed address.
7. Publish `/docs` using GitHub Pages.

## Safety

**Testnet / experimental software only.** LiteStream V1 is unaudited and provided as a builder prototype. Do not use meaningful real-world funds until the contract has undergone appropriate testing, review, and audit.
