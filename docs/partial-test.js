let partialWatchTimer=null;

function fmtLocal(ts){
  return new Date(Number(ts)*1000).toLocaleString(undefined,{hour12:false});
}

async function updatePartialWatch(){
  const out=$("partialTestResult");
  try{
    if(!contract) throw new Error("Connect wallet first.");
    const id=$("partialTestIdInput").value.trim();
    if(!id) throw new Error("Stream ID is required.");
    const s=await contract.getStream(id);
    const vested=await contract.vestedAmount(id);
    const pct=s.deposit===0n?0:Number((vested*10000n)/s.deposit)/100;
    const now=Math.floor(Date.now()/1000);
    const start=Number(s.startTime),end=Number(s.endTime);
    let state;
    if(s.canceled) state="Canceled";
    else if(now<start) state="Scheduled";
    else if(now>=end) state="Completed";
    else state="Streaming";
    let hint="";
    if(s.canceled) hint="Already canceled.";
    else if(pct>=100) hint="Too late for partial-cancel test: stream is fully vested.";
    else if(pct>=25){
      hint="READY: vested is at least 25%. Press Cancel Stream now.";
      $("cancelIdInput").value=id;
    } else if(now<start){
      hint=`Waiting to start. Starts in about ${Math.ceil((start-now)/60)} minute(s).`;
    } else {
      hint=`Keep watching. About ${(25-pct).toFixed(2)} percentage points to 25%.`;
    }
    out.textContent=[
      `Stream ID: ${id}`,
      `Status: ${state}`,
      `Vested: ${ethers.formatEther(vested)} zkLTC (${pct.toFixed(2)}%)`,
      `Local start: ${fmtLocal(s.startTime)}`,
      `Local end: ${fmtLocal(s.endTime)}`,
      `Local now: ${new Date().toLocaleString(undefined,{hour12:false})}`,
      `Action: ${hint}`
    ].join("\n");
  }catch(e){out.textContent=readableError(e);}
}

function startPartialWatch(){
  if(partialWatchTimer) clearInterval(partialWatchTimer);
  $("watch25Btn").disabled=true;
  $("stopWatchBtn").disabled=false;
  updatePartialWatch();
  partialWatchTimer=setInterval(updatePartialWatch,10000);
}

function stopPartialWatch(){
  if(partialWatchTimer){clearInterval(partialWatchTimer);partialWatchTimer=null;}
  $("watch25Btn").disabled=false;
  $("stopWatchBtn").disabled=true;
}

$("watch25Btn").addEventListener("click",startPartialWatch);
$("stopWatchBtn").addEventListener("click",stopPartialWatch);

const partialEnableTimer=setInterval(()=>{
  if(contract){
    $("watch25Btn").disabled=false;
    clearInterval(partialEnableTimer);
  }
},500);
