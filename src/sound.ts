import { gameAudio } from './runtime';
export type Cue = 'place' | 'swing' | 'putt' | 'land' | 'sand' | 'cup' | 'button' | 'penalty';
/** Small original instrument sounds, mixed through the platform's effects bus. */
export function playCue(cue: Cue, strength = 0.7) {
  const {ctx,sfx} = gameAudio();
  const tone = (hz:number, delay:number, duration:number, volume:number, endHz=hz) => {
    const start=ctx.currentTime+delay, osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(hz,start);osc.frequency.exponentialRampToValueAtTime(endHz,start+duration);
    gain.gain.setValueAtTime(0.001,start);gain.gain.linearRampToValueAtTime(volume,start+0.008);gain.gain.exponentialRampToValueAtTime(0.001,start+duration);
    osc.connect(gain);gain.connect(sfx);osc.start(start);osc.stop(start+duration+0.02);
  };
  const noise = (duration:number, volume:number, cutoff:number) => {
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate), data=buffer.getChannelData(0);
    let seed=1729;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/2147483648-1)*(1-i/data.length)**2;}
    const src=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    src.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.value=volume;
    src.connect(filter);filter.connect(gain);gain.connect(sfx);src.start();
  };
  if(cue==='place'){tone(260,0,0.16,0.15,120);noise(0.12,0.12,600);}
  if(cue==='swing'){noise(0.16,0.18+strength*0.1,2400);tone(700,0.015,0.07,0.16,130);}
  if(cue==='putt')tone(460,0,0.08,0.13,170);
  if(cue==='land'){tone(120,0,0.12,0.12,60);noise(0.09,0.1,500);}
  if(cue==='sand')noise(0.22,0.23,1100);
  if(cue==='cup'){tone(740,0,0.2,0.12);tone(930,0.12,0.24,0.12);tone(1110,0.24,0.5,0.12);}
  if(cue==='button')tone(450,0,0.08,0.06,620);
  if(cue==='penalty'){tone(250,0,0.2,0.1,170);tone(160,0.17,0.25,0.09,100);}
}
