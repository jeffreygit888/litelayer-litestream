# LiteStream

Programmable native-zkLTC payment streams on LitVM LiteForge.

## V1
- Native zkLTC deposits
- Linear vesting
- Recipient withdraws vested funds
- Optional sender cancellation
- Sender only receives unvested remainder on cancellation
- Inspect live stream state
- MetaMask + ethers.js frontend

## Network
- LitVM LiteForge
- Chain ID 4441
- Contract: deploy first

## Deploy
1. Open Remix.
2. Create `LiteStream.sol` from `contracts/LiteStream.sol`.
3. Compile with Solidity 0.8.20+.
4. Connect MetaMask to LiteForge.
5. Deploy.
6. Replace `DEPLOY_CONTRACT_FIRST` in `frontend/app.js` and `docs/app.js`.
7. Publish `/docs` with GitHub Pages.

## First test
Use two wallets.
- Amount: 0.001 zkLTC
- Duration: 10 minutes
- Cancelable: true

Test: create → inspect → wait → withdraw as recipient → inspect → cancel as sender.

## Safety
Unaudited testnet MVP. Do not use meaningful real-world funds.
