from pathlib import Path
import math,wave,struct,random
out=Path(__file__).resolve().parents[1]/'assets/resources/audio';out.mkdir(parents=True,exist_ok=True)
rng=random.Random(812)
for name,duration,freq in [('shot',.09,180),('impact',.12,95),('choose',.35,660),('ultimate',.6,75),('victory',.9,440)]:
 samples=[]
 for i in range(int(22050*duration)):
  t=i/22050;u=t/duration;env=(1-u)**3*min(1,t/.004)
  if name in ['shot','impact','ultimate']:s=(.5*math.sin(2*math.pi*freq*t*(1-u*.5))+.5*rng.uniform(-1,1))*env
  else:s=(math.sin(2*math.pi*freq*t)+.35*math.sin(2*math.pi*freq*1.5*t)+.25*math.sin(2*math.pi*freq*2*t))*env*.6
  samples.append(struct.pack('<h',int(max(-1,min(1,s))*.24*32767)))
 with wave.open(str(out/(name+'.wav')),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(22050);w.writeframes(b''.join(samples))
