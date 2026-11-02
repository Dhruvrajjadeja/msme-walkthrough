// Original synthesized ambience: tanpura-style plucks and a slow pentatonic flute.
export function createAmbientScore(context, destination) {
  const master=context.createGain(),dry=context.createGain(),wet=context.createGain();
  const reverb=context.createConvolver(),compressor=context.createDynamicsCompressor();
  const impulse=context.createBuffer(2,Math.ceil(context.sampleRate*2.4),context.sampleRate);
  let seed=17;
  for(let channel=0;channel<2;channel++){
    const samples=impulse.getChannelData(channel);
    for(let i=0;i<samples.length;i++){seed=(seed*16807)%2147483647;samples[i]=(seed/1073741823.5-1)*Math.pow(1-i/samples.length,3)*.28;}
  }
  reverb.buffer=impulse;dry.gain.value=.8;wet.gain.value=.22;master.gain.value=.55;
  dry.connect(master);reverb.connect(wet).connect(master);master.connect(compressor).connect(destination);
  compressor.threshold.value=-18;compressor.ratio.value=3;
  const real=new Float32Array(10),imag=new Float32Array(10);
  for(let h=1;h<10;h++)imag[h]=1/Math.pow(h,1.65);
  const strings=context.createPeriodicWave(real,imag);
  const phrase=[1,1.125,1.25,1.5,1.25,1.125,1,0,1.5,1.6666667,2,1.6666667,1.5,1.25,1.125,1];
  let step=0,next=context.currentTime+.1;
  function voice(frequency,time,duration,flute=false,previous=frequency){
    const oscillator=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
    if(flute)oscillator.type='sine';else oscillator.setPeriodicWave(strings);
    oscillator.frequency.setValueAtTime(previous,time);
    oscillator.frequency.exponentialRampToValueAtTime(frequency,time+(flute?.45:.015));
    filter.type='lowpass';filter.frequency.value=flute?1800:1400;
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(flute?.075:.055,time+(flute?.7:.025));
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    oscillator.connect(filter).connect(gain);gain.connect(dry);gain.connect(reverb);
    oscillator.start(time);oscillator.stop(time+duration+.05);
    oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();gain.disconnect();};
  }
  return {
    schedule(){
      next=Math.max(next,context.currentTime+.05);
      while(next<context.currentTime+2.5){
        voice([98.11,130.81,130.81,65.405][step%4],next,7);
        if(step%2===0){const index=(step/2)%phrase.length,ratio=phrase[index];if(ratio)voice(261.62*ratio,next+.35,5.8,true,261.62*(phrase[(index+phrase.length-1)%phrase.length]||ratio));}
        step++;next+=1.85;
      }
    },
  };
}

export function setupAmbientAudio(button) {
  let context,score,timer,enabled=false,queue=Promise.resolve();
  const update=()=>{
    button.setAttribute('aria-pressed',String(enabled));
    button.title=button.ariaLabel=enabled?'Mute ambient music':'Play Indian-classical ambient music';
  };
  function reconcile(){
    queue=queue.then(async()=>{
      clearInterval(timer);
      if(!context)return;
      if(!enabled||document.hidden){await context.suspend();return;}
      await context.resume();score.schedule();timer=setInterval(()=>score.schedule(),1000);
    }).catch(()=>{enabled=false;clearInterval(timer);update();button.title='Audio paused; tap to retry';});
    return queue;
  }
  button.onclick=async()=>{
    button.disabled=true;
    try{
      if(!context){context=new (window.AudioContext||window.webkitAudioContext)();score=createAmbientScore(context,context.destination);}
      enabled=!enabled;update();await reconcile();
    }catch{enabled=false;update();button.title='Audio unavailable; tap to retry';}
    finally{button.disabled=false;}
  };
  document.addEventListener('visibilitychange',reconcile);
  window.addEventListener('pagehide',()=>{clearInterval(timer);context?.suspend().catch(()=>{});});
  window.addEventListener('pageshow',reconcile);
  update();
}
