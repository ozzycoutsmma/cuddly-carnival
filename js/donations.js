/* Wallet strings are decoded from the user's supplied QRs and round-trip verified. */
(function (root) {
  'use strict';
  const wallets = Object.freeze([
    Object.freeze({id:'solana',name:'Solana',symbol:'SOL',network:'Solana',address:'2QGxB8mYXUKunA338wZBfK4c1ZFiW7BMwkELMUScu8PB'}),
    Object.freeze({id:'bitcoin',name:'Bitcoin',symbol:'BTC',network:'Bitcoin',address:'bc1qnqfnr93zvtujvvkmqpalvzqm64v32m38ug43sn'}),
    Object.freeze({id:'ethereum',name:'Ethereum',symbol:'ETH',network:'Ethereum',address:'0x41B9D4A23ff9Fc10934F1890fc70bee649a53ed2'}),
    Object.freeze({id:'tron',name:'TRON',symbol:'TRX',network:'TRON',address:'TZDmuBH2xnfKPALNRvkkhZsPDhM4BriFUZ'})
  ]);
  if (typeof module !== 'undefined' && module.exports) { module.exports = wallets; return; }
  document.addEventListener('DOMContentLoaded', () => {
    const trigger=document.getElementById('donate-open'),dialog=document.getElementById('donate-dialog');
    if (!trigger || !dialog) return;
    const address=document.getElementById('donate-address'),qr=document.getElementById('donate-qr'),network=document.getElementById('donate-network'),status=document.getElementById('donate-copy-status');
    const tabs=Array.from(dialog.querySelectorAll('[data-wallet]'));
    let selected=wallets[0];
    function render(id) {
      const wallet=wallets.find((w)=>w.id===id); if (!wallet) return;
      selected=wallet; address.value=wallet.address;
      address.setAttribute('aria-label',wallet.name+' donation address');
      // Never show the previous currency's QR beside the newly selected address.
      qr.style.visibility='hidden';
      qr.onload=()=>{qr.style.visibility='visible';};
      qr.onerror=()=>{status.textContent='QR unavailable — use the wallet address below.';};
      qr.src='donations/'+wallet.id+'.svg'; qr.alt=wallet.name+' donation QR code';
      document.getElementById('donate-wallet-name').textContent=wallet.name+' ('+wallet.symbol+')';
      network.textContent=wallet.network+' network'+(wallet.noTag?' · No destination tag required':'');
      status.textContent='';
      tabs.forEach((tab)=>{const active=tab.dataset.wallet===wallet.id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
    }
    trigger.addEventListener('click',()=>{render(selected.id);dialog.showModal();});
    document.getElementById('donate-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>trigger.focus());
    dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close();});
    tabs.forEach((tab,i)=>{
      tab.addEventListener('click',()=>render(tab.dataset.wallet));
      tab.addEventListener('keydown',(e)=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();render(tabs[next].dataset.wallet);tabs[next].focus();});
    });
    address.addEventListener('click',()=>address.select());
    document.getElementById('donate-copy').addEventListener('click',async()=>{
      const text=selected.address;
      address.focus(); address.select();
      try { if(!navigator.clipboard || !root.isSecureContext)throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); status.textContent='Address copied.'; }
      catch (_) { let copied=false; try { copied=document.execCommand('copy'); } catch (_) {} status.textContent=copied?'Address copied.':'Address selected — press Ctrl+C or use your device’s Copy option.'; }
    });
    render(selected.id);
  });
})(typeof self !== 'undefined'?self:globalThis);
