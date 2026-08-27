const CONTRACT_ADDRESS = "0x2b4485Ab77068166acb158079F7Bb10fc5dd676A";
const LITEFORGE_CHAIN_ID = 4441n;
const ABI = [
  "function createStream(address recipient,uint64 startTime,uint64 endTime,bool cancelable) payable returns (uint256)",
  "function withdraw(uint256 streamId)",
  "function cancelStream(uint256 streamId)",
  "function streamCount() view returns (uint256)",
  "function vestedAmount(uint256 streamId) view returns (uint256)",
  "function withdrawableAmount(uint256 streamId) view returns (uint256)",
  "function getStream(uint256 streamId) view returns ((address sender,address recipient,uint256 deposit,uint256 withdrawn,uint64 startTime,uint64 endTime,uint64 canceledAt,bool cancelable,bool canceled))"
];

let provider, signer, contract, connectedAddress;
const $ = id => document.getElementById(id);

function readableError(error) {
  const parts = [];
  if (error?.shortMessage) parts.push(`Error: ${error.shortMessage}`);
  if (error?.message && error.message !== error?.shortMessage) parts.push(`Message: ${error.message}`);
  if (error?.code) parts.push(`Code: ${error.code}`);
  if (error?.info?.error?.message) parts.push(`RPC: ${error.info.error.message}`);
  if (error?.info?.error?.data) parts.push(`RPC data: ${typeof error.info.error.data === "string" ? error.info.error.data : JSON.stringify(error.info.error.data)}`);
  if (error?.data) parts.push(`Data: ${typeof error.data === "string" ? error.data : JSON.stringify(error.data)}`);
  if (error?.payload?.method) parts.push(`RPC method: ${error.payload.method}`);
  return parts.length ? [...new Set(parts)].join("\n") : "Unknown error";
}

async function ensureLiteForge() {
  const network = await provider.getNetwork();
  if (network.chainId !== LITEFORGE_CHAIN_ID) throw new Error(`Wrong network. Switch MetaMask to LitVM LiteForge (Chain ID 4441). Current: ${network.chainId}`);
}

async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error("MetaMask was not detected.");
    const accounts = await window.ethereum.request({method:"eth_requestAccounts"});
    connectedAddress = accounts[0];
    provider = new ethers.BrowserProvider(window.ethereum);
    await ensureLiteForge();
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    $("walletStatus").textContent = `Connected: ${connectedAddress}`;
    $("connectBtn").textContent = "Wallet Connected";
    ["createBtn","fundBtn","inspectBtn","withdrawBtn","cancelBtn"].forEach(id => $(id).disabled = false);
  } catch (e) { $("walletStatus").textContent = readableError(e); }
}

async function sendWithEstimatedGas(txRequest) {
  await ensureLiteForge();
  let estimated;
  try {
    estimated = await provider.estimateGas({...txRequest, from: connectedAddress});
  } catch (e) {
    throw new Error(`Gas estimation failed. ${readableError(e)}`);
  }
  const gasLimit = (estimated * 130n) / 100n + 10000n;
  const latestBlock = await provider.getBlock("latest");
  const baseFee = latestBlock?.baseFeePerGas || 0n;
  const priorityFee = ethers.parseUnits("0.1", "gwei");
  const maxFeePerGas = baseFee > 0n ? (baseFee * 150n) / 100n + priorityFee : undefined;
  const feeOverrides = maxFeePerGas ? {maxFeePerGas, maxPriorityFeePerGas: priorityFee} : {};
  try {
    const tx = await signer.sendTransaction({...txRequest, gasLimit, ...feeOverrides});
    return {tx, gasLimit, estimated, baseFee, maxFeePerGas};
  } catch (e) {
    const wrapped = new Error(`Transaction submission failed. ${readableError(e)}`);
    wrapped.original = e;
    throw wrapped;
  }
}

async function fundTestWallet() {
  try {
    const recipient = $("fundRecipientInput").value.trim();
    const amount = $("fundAmountInput").value.trim();
    if (!ethers.isAddress(recipient)) throw new Error("Invalid recipient address.");
    if (!amount || Number(amount) <= 0) throw new Error("Amount must be greater than zero.");
    if (recipient.toLowerCase() === connectedAddress.toLowerCase()) throw new Error("Recipient must be another wallet.");
    $("fundBtn").disabled = true;
    $("fundResult").textContent = "Reading latest LitVM base fee...";
    await ensureLiteForge();

    const latestBlock = await provider.getBlock("latest");
    if (!latestBlock) throw new Error("Could not read latest LitVM block.");
    const baseFee = latestBlock.baseFeePerGas || 0n;
    const priorityFee = ethers.parseUnits("0.1", "gwei");
    const maxFeePerGas = baseFee > 0n ? (baseFee * 150n) / 100n + priorityFee : ethers.parseUnits("5", "gwei");
    const value = ethers.parseEther(amount);

    $("fundResult").textContent = [
      "Preparing native zkLTC transfer...",
      `Base fee: ${ethers.formatUnits(baseFee, "gwei")} Gwei`,
      `Max fee: ${ethers.formatUnits(maxFeePerGas, "gwei")} Gwei`
    ].join("\n");

    const tx = await signer.sendTransaction({
      to: recipient,
      value,
      gasLimit: 21000n,
      maxFeePerGas,
      maxPriorityFeePerGas: priorityFee
    });

    $("fundResult").textContent = `Submitted: ${tx.hash}\nWaiting for confirmation...`;
    const receipt = await tx.wait();
    $("fundResult").textContent = [
      `Confirmed in block ${receipt.blockNumber}`,
      `Tx: ${tx.hash}`,
      `Sent: ${amount} zkLTC`,
      `To: ${recipient}`,
      `Base fee used for quote: ${ethers.formatUnits(baseFee, "gwei")} Gwei`,
      `Max fee: ${ethers.formatUnits(maxFeePerGas, "gwei")} Gwei`
    ].join("\n");
  } catch (e) {
    console.error(e);
    $("fundResult").textContent = readableError(e.original || e);
  } finally { $("fundBtn").disabled = false; }
}

async function createStream() {
  try {
    const recipient=$("recipientInput").value.trim(); const amount=$("amountInput").value.trim(); const durationMinutes=Number($("durationInput").value); const cancelable=$("cancelableInput").checked;
    if(!ethers.isAddress(recipient)) throw new Error("Invalid recipient address.");
    if(!amount||Number(amount)<=0) throw new Error("Amount must be greater than zero.");
    if(!Number.isFinite(durationMinutes)||durationMinutes<2) throw new Error("Use a duration of at least 2 minutes.");
    $("createBtn").disabled=true; $("createResult").textContent="Reading latest LitVM block...";
    const latestBlock=await provider.getBlock("latest"); if(!latestBlock) throw new Error("Could not read latest LitVM block.");
    const startTime=BigInt(latestBlock.timestamp+300); const endTime=startTime+BigInt(Math.floor(durationMinutes*60)); const value=ethers.parseEther(amount);
    const data=contract.interface.encodeFunctionData("createStream",[recipient,startTime,endTime,cancelable]);
    const {tx,gasLimit,estimated}=await sendWithEstimatedGas({to:CONTRACT_ADDRESS,data,value});
    $("createResult").textContent=`Submitted: ${tx.hash}\nWaiting for confirmation...`; const receipt=await tx.wait(); const count=await contract.streamCount();
    $("createResult").textContent=[`Confirmed in block ${receipt.blockNumber}`,`Tx: ${tx.hash}`,`Estimated gas: ${estimated}`,`Gas limit: ${gasLimit}`,`Stream ID: ${count}`,`Deposit: ${amount} zkLTC`,`Starts: ${new Date(Number(startTime)*1000).toISOString()}`,`Ends: ${new Date(Number(endTime)*1000).toISOString()}`,`Cancelable: ${cancelable}`].join("\n");
    ["inspectIdInput","withdrawIdInput","cancelIdInput"].forEach(id=>$(id).value=count.toString());
  } catch(e){console.error(e);$("createResult").textContent=readableError(e.original||e);} finally{$("createBtn").disabled=false;}
}

function statusOf(stream){if(stream.canceled)return"Canceled";const now=Math.floor(Date.now()/1000);if(now<Number(stream.startTime))return"Scheduled";if(now>=Number(stream.endTime))return"Completed";return"Streaming";}
async function inspectStream(){try{const id=$("inspectIdInput").value.trim();if(!id)throw new Error("Stream ID is required.");await ensureLiteForge();const stream=await contract.getStream(id);const vested=await contract.vestedAmount(id);const withdrawable=await contract.withdrawableAmount(id);const pct=stream.deposit===0n?0:Number((vested*10000n)/stream.deposit)/100;$("streamMeter").classList.remove("hidden");$("meterText").textContent=`${Math.min(pct,100).toFixed(2)}%`;$("meterBar").style.width=`${Math.min(pct,100)}%`;$("inspectResult").textContent=[`Stream ID: ${id}`,`Status: ${statusOf(stream)}`,`Sender: ${stream.sender}`,`Recipient: ${stream.recipient}`,`Deposit: ${ethers.formatEther(stream.deposit)} zkLTC`,`Vested: ${ethers.formatEther(vested)} zkLTC`,`Withdrawn: ${ethers.formatEther(stream.withdrawn)} zkLTC`,`Withdrawable now: ${ethers.formatEther(withdrawable)} zkLTC`,`Starts: ${new Date(Number(stream.startTime)*1000).toISOString()}`,`Ends: ${new Date(Number(stream.endTime)*1000).toISOString()}`,`Cancelable: ${stream.cancelable}`,`Canceled: ${stream.canceled}`].join("\n");}catch(e){$("inspectResult").textContent=readableError(e);}}
async function withdrawStream(){try{const id=$("withdrawIdInput").value.trim();if(!id)throw new Error("Stream ID is required.");$("withdrawBtn").disabled=true;const available=await contract.withdrawableAmount(id);if(available===0n)throw new Error("Nothing is withdrawable yet.");const data=contract.interface.encodeFunctionData("withdraw",[id]);const{tx,gasLimit}=await sendWithEstimatedGas({to:CONTRACT_ADDRESS,data,value:0n});$("withdrawResult").textContent=`Submitted: ${tx.hash}\nWaiting for confirmation...`;const receipt=await tx.wait();$("withdrawResult").textContent=`Withdrawal confirmed in block ${receipt.blockNumber}\nTx: ${tx.hash}\nGas limit: ${gasLimit}\nAvailable before withdrawal: ${ethers.formatEther(available)} zkLTC`;}catch(e){$("withdrawResult").textContent=readableError(e.original||e);}finally{$("withdrawBtn").disabled=false;}}
async function cancelStream(){try{const id=$("cancelIdInput").value.trim();if(!id)throw new Error("Stream ID is required.");$("cancelBtn").disabled=true;const stream=await contract.getStream(id);if(stream.sender.toLowerCase()!==connectedAddress.toLowerCase())throw new Error("Only the stream sender can cancel.");if(!stream.cancelable)throw new Error("This stream is not cancelable.");if(stream.canceled)throw new Error("This stream is already canceled.");const data=contract.interface.encodeFunctionData("cancelStream",[id]);const{tx,gasLimit}=await sendWithEstimatedGas({to:CONTRACT_ADDRESS,data,value:0n});$("cancelResult").textContent=`Submitted: ${tx.hash}\nWaiting for confirmation...`;const receipt=await tx.wait();$("cancelResult").textContent=`Stream ${id} canceled in block ${receipt.blockNumber}\nTx: ${tx.hash}\nGas limit: ${gasLimit}\nRecipient keeps vested funds; sender receives only the unvested remainder.`;}catch(e){$("cancelResult").textContent=readableError(e.original||e);}finally{$("cancelBtn").disabled=false;}}

$("connectBtn").addEventListener("click",connectWallet);$("fundBtn").addEventListener("click",fundTestWallet);$("createBtn").addEventListener("click",createStream);$("inspectBtn").addEventListener("click",inspectStream);$("withdrawBtn").addEventListener("click",withdrawStream);$("cancelBtn").addEventListener("click",cancelStream);if(window.ethereum){window.ethereum.on("chainChanged",()=>window.location.reload());window.ethereum.on("accountsChanged",()=>window.location.reload());}
