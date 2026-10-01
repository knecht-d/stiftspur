// Four related shapes per character; word gestures share smooth latent curves.
// All dimensions are in em. No noise is added independently to path vertices.
export const variationKeys=['form','flow','rhythm','irregular'];
export const defaultWeights={form:70,flow:60,rhythm:45,irregular:15};
export function handwritingVariation(strength,weights=defaultWeights){
 return Object.fromEntries(variationKeys.map(key=>[key,strength*weights[key]/100]));
}
function hash(s){let n=2166136261;for(const ch of s)n=Math.imul(n^ch.codePointAt(0),16777619);return n>>>0;}
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
function curve(values,t){const i=t<.5?0:1,f=smooth(i===0?t*2:(t-.5)*2);return values[i]+(values[i+1]-values[i])*f;}
const family=[[-.8,.3,-.5,.8,-.4],[.65,-.35,.35,-.65,.55],[-.3,-.6,.7,.4,.7],[.45,.65,-.45,-.5,-.65]];

export function wordContexts(text,seed,segmentId=0){
 const out=[],lastVariant=new Map();let wordIndex=0;
 for(const token of text.match(/\S+|\s+/gu)||[]){
  const chars=Array.from(token),word=hash(`${seed}:word:${segmentId}:${wordIndex++}:${token}`),rng=random(word),signed=()=>rng()*2-1;
  const gesture={height:[signed(),signed(),signed()],slant:[signed(),signed(),signed()],baseline:[signed(),signed(),signed()],tilt:signed(),pace:signed(),space:signed()};
  for(let i=0;i<chars.length;i++){
   const ch=chars[i],base=ch.normalize('NFD')[0],previous=chars[i-1]||'^',next=chars[i+1]||'$';
   let variant=hash(`${word}:${i}:${base}:${previous}:${next}`)%4;
   // Repeated letters do not immediately reuse a form, including across words.
   if(lastVariant.get(base)===variant)variant=(variant+1+hash(`${word}:${i}`)%3)%4;
   lastVariant.set(base,variant);
   out.push({gesture,t:chars.length>1?i/(chars.length-1):.5,variant,base,noise:hash(`${word}:residual:${i}`)});
  }
 }
 return out;
}

export function naturalGlyph(raw,ch,unitsPerEm,context,variation){
 // 100% is intentionally pronounced; controls have no early saturation.
 const gain={form:3.5,flow:3.5,rhythm:3.25,irregular:8};
 const v=Object.fromEntries(variationKeys.map(k=>[k,gain[k]*variation[k]/100]));
 const original=raw.strokes.map(s=>s.map(([x,y])=>[x/unitsPerEm,-y/unitsPerEm]));
 const advance=raw.advance/unitsPerEm;
 if(!variationKeys.some(k=>v[k]))return {advance,strokes:original,baselineOffset:0,variant:context.variant};
 const {gesture:g,t,variant}=context,rng=random(context.noise),signed=()=>rng()*2-1;
 const proto=family[(variant+hash(context.base)%4)%4];
 const height=1+.085*v.flow*curve(g.height,t)+.055*v.form*proto[1]+.02*v.irregular*signed();
 const width=1+.09*v.form*proto[0]+.04*v.flow*curve(g.height,t)+.018*v.irregular*signed();
 const slant=.11*v.flow*curve(g.slant,t)+.035*v.form*proto[2]+.012*v.irregular*signed();
 const angle=.022*v.flow*g.tilt+.009*v.irregular*signed(),cos=Math.cos(angle),sin=Math.sin(angle);
 const baselineOffset=v.flow*(.055*curve(g.baseline,t)+.028*g.tilt*(t-.5))+.009*v.irregular*signed();
 const center=advance/2;
 const transform=([x,y])=>{
  const nx=clamp((x-center)/Math.max(.2,advance),-1,1),body=Math.sin(Math.PI*clamp(-y/.9,0,1));
  // A continuous field changes shoulders/bowls without tearing shared junctions.
  // Dots and accents receive the same glyph transform; they never jitter alone.
  const px=(x-center)*width-y*slant+v.form*.035*proto[3]*body*(1-nx*nx);
  const py=y*height+v.form*.03*proto[4]*body*nx;
  return [center+px*cos-py*sin,px*sin+py*cos];
 };
 const strokes=original.map(stroke=>{
  const dense=[stroke[0]];
  for(let i=1;i<stroke.length;i++){
   const a=stroke[i-1],b=stroke[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.07));
   for(let j=1;j<=steps;j++)dense.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
  }
  return dense.map(transform);
 });
 const spacing=ch===' '?1+v.rhythm*.22*g.space:width*(1+v.rhythm*.055*g.pace*(1-.3*t));
 return {advance:advance*spacing,strokes,baselineOffset,variant};
}
