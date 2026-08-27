(function(){
  const btn=document.getElementById('switchWalletBtn');
  if(!btn)return;
  btn.addEventListener('click',async()=>{
    try{
      if(!window.ethereum)throw new Error('MetaMask was not detected.');
      const status=document.getElementById('walletStatus');
      if(status)status.textContent='Opening MetaMask account selector...';
      await window.ethereum.request({
        method:'wallet_requestPermissions',
        params:[{eth_accounts:{}}]
      });
      const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
      if(status)status.textContent=`Selected: ${accounts[0]||'none'}`;
      window.location.reload();
    }catch(e){
      const status=document.getElementById('walletStatus');
      if(status)status.textContent=e?.message||String(e);
    }
  });
})();
