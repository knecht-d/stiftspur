// Conservative horizontal ink profiles, in em units. All strokes of a glyph
// share their horizontal position, including dots and accents.
const step=.025;
export function inkProfile(strokes,dy=0){const bins=new Map();
 for(const stroke of strokes)for(let i=1;i<stroke.length;i++){const a=stroke[i-1],b=stroke[i],lo=Math.floor((Math.min(a[1],b[1])+dy)/step),hi=Math.floor((Math.max(a[1],b[1])+dy)/step),min=Math.min(a[0],b[0]),max=Math.max(a[0],b[0]);for(let n=lo;n<=hi;n++){const old=bins.get(n);bins.set(n,old?[Math.min(old[0],min),Math.max(old[1],max)]:[min,max]);}}
 return bins;
}
export function opticalGlyphs(glyphs,size,strokeWidth,strength){
 if(!strength||strokeWidth/size>=.5)return glyphs;
 const gap=strokeWidth/size+.04,radius=Math.ceil(gap/step),occupied=new Map();let cursor=0,previous=null;
 return glyphs.map(g=>{let tuck=0;
   if(g.ch===' '||!g.profile?.size){occupied.clear();previous=null;}
   else if(previous&&occupied.size){let minimum=-Infinity;
     for(const [bin,[left]] of g.profile)for(let n=bin-radius;n<=bin+radius;n++){const right=occupied.get(n);if(right!==undefined)minimum=Math.max(minimum,right-left+gap);}
     if(Number.isFinite(minimum))tuck=Math.max(0,Math.min(cursor-minimum,previous.advance*.45))*strength/100;
   }
   cursor-=tuck;
   if(g.profile?.size){for(const [bin,[,right]] of g.profile)occupied.set(bin,Math.max(occupied.get(bin)??-Infinity,cursor+right));previous=g;}
   cursor+=g.advance;return {...g,tuck};
 });
}
