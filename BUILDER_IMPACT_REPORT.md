# LiteStream Builder Impact Report

**Project:** LiteStream  
**Builder:** LiteLayer Labs  
**Network:** LitVM LiteForge  
**Chain ID:** `4441`  
**Status:** Deployed testnet MVP  
**Public demo:** https://jeffreygit888.github.io/litelayer-litestream/  
**Repository:** https://github.com/jeffreygit888/litelayer-litestream  
**Deployed contract:** `0x2b4485Ab77068166acb158079F7Bb10fc5dd676A`

---

## 1. Executive Summary

LiteStream is a programmable payment-streaming primitive built natively on LitVM LiteForge. It allows a sender to lock native zkLTC into a time-based stream in which funds vest linearly to a recipient.

The recipient can withdraw only the amount that has vested. If a stream is cancelable, the sender can cancel it and recover only the unvested remainder, while the recipient retains the vested portion.

The objective of this build was not only to deploy a smart contract, but to validate a complete payment lifecycle on LitVM: creation, vesting, withdrawal, cancellation, settlement, wallet interaction, and native zkLTC transaction behavior.

The MVP is deployed and has been tested end-to-end using multiple wallets on LitVM LiteForge.

---

## 2. Problem

Most blockchain payments are modeled as one-time transfers. That works for simple payments, but it does not naturally support agreements where money should become available gradually over time.

Examples include:

- contractor and freelancer compensation,
- payroll,
- grants,
- creator payouts,
- treasury distributions,
- subscriptions,
- founder or contributor vesting,
- scheduled or time-based settlements.

Without a payment-streaming primitive, these use cases require repeated manual transfers, centralized payment logic, or custom application-specific settlement systems.

---

## 3. Solution

LiteStream converts native zkLTC into programmable, time-based money.

A sender creates a stream by defining:

- recipient address,
- deposit amount,
- start time,
- end time,
- whether the stream can be canceled.

The contract then calculates vesting linearly over time.

### Core behavior

**Before the stream starts**  
No funds are vested.

**While the stream is active**  
The recipient earns a proportional share of the deposit as time passes.

**At the end of the stream**  
The full deposit is vested.

**Recipient withdrawal**  
The recipient may withdraw only the currently vested and previously unwithdrawn amount.

**Cancelable streams**  
When the sender cancels:

- the recipient receives the vested but unpaid amount,
- the sender receives only the unvested remainder,
- vesting stops at the cancellation timestamp.

---

## 4. Why LitVM

LiteStream was built as a LitVM-native testnet MVP because payment streaming is a direct example of programmable money.

Rather than treating native zkLTC only as an asset that can be transferred from one wallet to another, LiteStream demonstrates how zkLTC can participate in transparent on-chain payment rules.

This creates a reusable payment primitive that can later serve as infrastructure for payroll, recurring payouts, grants, vesting, treasury automation, creator payments, and other time-dependent settlement models.

---

## 5. Technical Architecture

### Smart contract

Contract: `LiteStream.sol`

Primary functions:

- `createStream(...)`
- `vestedAmount(streamId)`
- `withdrawableAmount(streamId)`
- `withdraw(streamId)`
- `cancelStream(streamId)`
- `getStream(streamId)`

The contract stores each stream with:

- sender,
- recipient,
- total deposit,
- total withdrawn,
- start time,
- end time,
- cancellation timestamp,
- cancelable flag,
- canceled flag.

A simple reentrancy guard protects value-transfer operations.

### Frontend

The public test frontend uses:

- HTML/CSS/JavaScript,
- ethers.js,
- MetaMask,
- GitHub Pages.

The frontend supports:

- wallet connection,
- wallet account switching,
- stream creation,
- stream inspection,
- live vesting progress,
- recipient withdrawal,
- sender cancellation,
- test-wallet funding,
- partial-cancel test monitoring.

---

## 6. Deployment

**Network:** LitVM LiteForge  
**Chain ID:** `4441`  
**Contract address:** `0x2b4485Ab77068166acb158079F7Bb10fc5dd676A`

The contract was compiled with Solidity `0.8.20` and deployed through Remix using MetaMask Browser Extension connectivity.

---

## 7. Test Methodology

Testing used two separate MetaMask accounts:

**Sender wallet**  
`0xA5234FbF59102141De425388C6567FB0E65E0AB1`

**Recipient wallet**  
`0xff061CC5f8dD2bd93e3562041ec43A0297D312A7`

The goal was to validate each major stream state independently rather than only testing a single happy path.

---

## 8. Test Results

### Test A — Stream creation

A stream was successfully created with native zkLTC.

**Transaction:**  
`0xf955c395feb8647d333d818a6a47f638a96426c7cbca594cda847c822041cd92`

**Block:** `44406726`

**Observed parameters:**

- Stream ID: `2`
- Deposit: `0.001 zkLTC`
- Duration: 10 minutes
- Cancelable: `true`

Result: **PASS**

---

### Test B — Normal recipient withdrawal after full vesting

The recipient successfully withdrew the full vested balance after the stream completed.

**Transaction:**  
`0x362f8599959cfc983ed6e672c5caab49eed9388b8a0ce7545e2c73ebec9e2405`

**Block:** `44406064`

**Available before withdrawal:**  
`0.001 zkLTC`

**Gas limit used:**  
`120559`

Result: **PASS**

This validates the normal lifecycle:

`create → vest → withdraw → settled`

---

### Test C — Cancellation before vesting begins

A cancelable stream was canceled before its start time.

**Cancellation transaction:**  
`0x09e28ea5e6c779b56264cd4d327f82566e841f8b79f51562c06778f63eff21f7`

**Block:** `44406831`

Final state:

- Deposit: `0.001 zkLTC`
- Vested: `0`
- Withdrawn: `0`
- Withdrawable: `0`
- Canceled: `true`

Expected economic behavior:

- recipient receives `0`,
- sender receives the full unvested deposit back.

Result: **PASS**

---

### Test D — Cancellation after full vesting

A stream was canceled after the full deposit had already vested.

**Cancellation transaction:**  
`0xd8d6beecf5093f9c50bf7713e9b65b259a6130bdeb7a5d694448d9b8a382fbaf`

**Block:** `44425198`

Final state:

- Deposit: `0.001 zkLTC`
- Vested: `0.001 zkLTC`
- Withdrawn: `0.001 zkLTC`
- Withdrawable: `0`
- Canceled: `true`

Expected economic behavior:

- recipient receives the full deposit,
- sender receives no refund.

Result: **PASS**

---

### Test E — Partial-vesting cancellation

This was the most important settlement test.

A stream was canceled while only part of its deposit had vested.

Final Stream ID `4` state:

- Deposit: `0.001 zkLTC`
- Vested: `0.000455833333333333 zkLTC`
- Withdrawn: `0.000455833333333333 zkLTC`
- Withdrawable: `0`
- Canceled: `true`

Calculated settlement:

**Recipient vested settlement:**  
`0.000455833333333333 zkLTC`

**Sender unvested refund:**  
`0.000544166666666667 zkLTC`

The contract correctly froze vesting at cancellation and split the deposit according to elapsed time.

Result: **PASS**

---

## 9. Native zkLTC Wallet-Funding Test

During testing, the recipient wallet required native zkLTC to pay transaction fees before it could initiate a withdrawal.

A native wallet-to-wallet funding flow was therefore tested.

**Transaction:**  
`0x4765e4077e7b77d5ad5587cf03f7376844eab07d5726f375074318163820696e`

**Block:** `44403658`

**Amount:**  
`0.001 zkLTC`

**Recipient:**  
`0xff061CC5f8dD2bd93e3562041ec43A0297D312A7`

Result: **PASS**

---

## 10. LitVM / LiteForge Technical Findings

The build process identified several practical network behaviors that materially affected transaction submission.

### Finding 1 — `maxFeePerGas` could fall below the current block base fee

MetaMask-generated transactions were observed failing with:

`max fee per gas less than block base fee`

The difference between the suggested max fee and the actual base fee could be very small, but the transaction was still rejected by the RPC.

### Mitigation

The frontend was modified to:

1. read the latest block `baseFeePerGas`,
2. apply a fee buffer above the base fee,
3. explicitly supply `maxFeePerGas` and `maxPriorityFeePerGas`.

This significantly improved transaction reliability during testing.

---

### Finding 2 — Standard 21,000 gas native transfers were rejected

A native wallet-to-wallet transaction using the standard Ethereum transfer gas limit of `21,000` was rejected with:

`intrinsic gas too low`

The RPC gas estimate was observed near the standard EVM range, but actual transaction submission still required a larger gas limit.

### Mitigation

For the test frontend, a conservative minimum gas limit of `100,000` was introduced for native zkLTC test transfers.

A successful transfer later reported:

- estimated gas: `21174`,
- gas limit: `100000`.

This behavior has been documented in the project so it can be reproduced and investigated further.

---

### Finding 3 — Recipient must hold gas independently

Even when a recipient has value vested inside a LiteStream contract, that locked or withdrawable value cannot pay the transaction fee required to call `withdraw()` before the transaction executes.

The recipient therefore needs a native gas balance independently.

This is normal for standard EVM transaction semantics, but it creates an important UX consideration for payment-streaming applications.

### Future improvement

Possible V2 directions include:

- sponsored transactions,
- relayers,
- account abstraction,
- gas sponsorship if supported by the target LitVM infrastructure.

---

## 11. Product and UX Findings

### Start-time safety buffer

The current frontend schedules a stream start several minutes after the latest block timestamp.

This was initially introduced to avoid start-time failures caused by timing differences between frontend execution and block inclusion.

However, testing showed that this delay can make short-duration streams inconvenient.

Future versions should reduce or remove frontend timestamp guesswork.

A stronger design would allow the contract itself to use `block.timestamp` as the authoritative stream start when appropriate.

---

### Wallet account permissions

Switching MetaMask's visible account did not always change the account exposed to the website because the site's existing account permission remained active.

The frontend was therefore extended with an explicit wallet-account switching flow to make multi-wallet testing easier.

---

## 12. Contribution to the LitVM Testnet

The LiteStream build produced more than a deployed contract.

It exercised:

- native zkLTC deposits,
- native zkLTC wallet transfers,
- payable contract calls,
- contract-to-wallet native-value transfers,
- linear timestamp-based state calculations,
- multiple account roles,
- EIP-1559 style fee parameters,
- gas estimation,
- RPC transaction submission,
- MetaMask account permissions,
- public frontend interaction through GitHub Pages.

The project also surfaced reproducible transaction issues related to fee calculation and intrinsic gas behavior and documented frontend mitigations used to complete testing successfully.

---

## 13. Current MVP Capabilities

The deployed MVP currently supports:

- native zkLTC payment streams,
- linear vesting,
- configurable duration,
- cancelable and non-cancelable streams,
- recipient withdrawals,
- sender cancellation,
- automatic settlement of vested funds during cancellation,
- automatic refund of unvested funds,
- stream-state inspection,
- visual vesting progress,
- test-wallet native zkLTC funding,
- wallet account switching,
- partial-cancel testing helper.

---

## 14. Known Limitations

LiteStream is an experimental testnet MVP and has not been audited.

Current limitations include:

- no production security audit,
- no contract upgrade mechanism,
- no batch stream creation,
- no stream NFT or transferable ownership,
- no off-chain indexing service,
- no transaction history dashboard,
- recipient requires its own gas balance,
- frontend still uses a conservative stream-start buffer,
- no automated recurring stream renewal,
- no relayer or gas-sponsorship layer,
- no formal unit-test suite in Hardhat/Foundry yet.

The current deployment should not be used for meaningful real-world funds.

---

## 15. Roadmap

### V2 — Reliability and developer tooling

Planned improvements:

- contract-level start-time handling,
- Hardhat or Foundry automated tests,
- event-indexed stream history,
- cleaner transaction status and explorer links,
- more precise LitVM gas strategy,
- additional validation around completed-stream cancellation.

### V3 — Payment infrastructure

Potential extensions:

- recurring payroll streams,
- batch payouts,
- team and grant distributions,
- cliff + linear vesting,
- milestone-triggered streams,
- stream templates,
- treasury dashboards,
- protocol integrations.

### V4 — User-experience infrastructure

Research areas:

- relayers,
- gas sponsorship,
- account abstraction,
- delegated withdrawals,
- notification services,
- mobile-friendly wallet UX.

---

## 16. Broader LiteLayer Labs Direction

LiteStream is being developed under LiteLayer Labs as part of a broader set of programmable payment and settlement primitives for LitVM.

The intended direction is modular infrastructure rather than one monolithic application.

Examples include:

- **LiteReceipt** — verifiable payment / receipt records,
- **LiteStream** — time-based settlement,
- **LiteSplit** — programmable revenue distribution,
- **LiteEscrow** — conditional settlement.

Together these primitives can provide reusable building blocks for applications that need transparent payment state and programmable zkLTC settlement.

---

## 17. Impact Summary

LiteStream demonstrates that native zkLTC can support continuous payment logic on LitVM rather than only point-in-time transfers.

The MVP successfully validated:

- contract deployment,
- native-value deposits,
- linear vesting,
- full withdrawal,
- pre-start cancellation,
- post-vesting settlement,
- partial-vesting cancellation,
- automatic recipient/sender settlement,
- multi-wallet interaction,
- practical fee and gas handling on LiteForge.

The most important validated case was partial cancellation, where a `0.001 zkLTC` stream was correctly divided into:

- `0.000455833333333333 zkLTC` vested to the recipient,
- `0.000544166666666667 zkLTC` refunded to the sender.

This confirms the core economic behavior of the LiteStream concept on the LitVM LiteForge testnet.

---

## 18. Links

**GitHub repository**  
https://github.com/jeffreygit888/litelayer-litestream

**Public demo**  
https://jeffreygit888.github.io/litelayer-litestream/

**Contract**  
`0x2b4485Ab77068166acb158079F7Bb10fc5dd676A`

---

## Disclaimer

LiteStream is an unaudited experimental testnet project. The deployment and results in this report are intended for development, testing, and ecosystem evaluation only.