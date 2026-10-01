// Geometry ported from postcard_line_svg.py. Coordinates stay in millimetres.
export const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function clean(points) { return points.filter((p,i)=>!i || distance(p,points[i-1])>1e-9); }
export function length(points) { return points.slice(1).reduce((s,p,i)=>s+distance(points[i],p),0); }
export function at(points,f) {
  const target=length(points)*f; let acc=0;
  for(let i=1;i<points.length;i++) { const seg=distance(points[i-1],points[i]); if(acc+seg>=target) { const t=seg? (target-acc)/seg:0; return points[i-1].map((v,j)=>v+t*(points[i][j]-v)); } acc+=seg; }
  return points.at(-1);
}
export function retraces(points,tolerance=1) {
  const p=clean(points); if(p.length<3) return true;
  return [.1,.2,.3,.4].every(f=>distance(at(p,f),at(p,1-f))<=tolerance);
}
export function firstHalf(points) {
  const p=clean(points); if(p.length<2)return p; const target=length(p)/2; const out=[p[0]]; let acc=0;
  for(let i=1;i<p.length;i++) { const seg=distance(p[i-1],p[i]); if(seg<=1e-12)continue;
    if(acc+seg<target-1e-9) { out.push(p[i]); acc+=seg; } else { const t=Math.max(0,Math.min(1,(target-acc)/seg)); out.push(p[i-1].map((v,j)=>v+t*(p[i][j]-v)));break; }
  } return clean(out);
}
function lineDistance(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
  return distance(p,[a[0]+t*dx,a[1]+t*dy]);
}
export function simplify(points,tolerance) {
  // Iterative RDP avoids call-stack limits on complex glyphs.
  if(points.length<=2)return points; const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length) { const [a,b]=stack.pop();let max=-1,idx=-1;
    for(let i=a+1;i<b;i++) { const d=lineDistance(points[i],points[a],points[b]); if(d>max){max=d;idx=i;} }
    if(max>tolerance) { keep.add(idx);stack.push([a,idx],[idx,b]); }
  } return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
export function flatten(commands,steps=14) {
  const contours=[]; let current=null,start=null,pos=null;
  const end=()=>{if(current?.length)contours.push(current); current=null;start=null;};
  for(const c of commands) {
    if(c.type==='M') { end();pos=[c.x,c.y];current=[pos];start=pos; }
    else if(c.type==='L') { pos=[c.x,c.y];current.push(pos); }
    else if(c.type==='Q' || c.type==='C') { const p=pos;
      for(let i=1;i<=steps;i++) { const t=i/steps,u=1-t;
        current.push(c.type==='Q' ? [u*u*p[0]+2*u*t*c.x1+t*t*c.x,u*u*p[1]+2*u*t*c.y1+t*t*c.y] : [u**3*p[0]+3*u*u*t*c.x1+3*u*t*t*c.x2+t**3*c.x,u**3*p[1]+3*u*u*t*c.y1+3*u*t*t*c.y2+t**3*c.y]);
      }pos=[c.x,c.y];
    } else if(c.type==='Z') { if(current?.length && distance(current.at(-1),start)>1e-9)current.push(start);end(); }
  }end();return contours;
}
const num=v=>v.toFixed(4);
export function glyphCommands(glyph) {
  const path=glyph.path; // Force lazy TrueType parsing, including composite points.
  if(!glyph.points?.length)return path.commands;
  const contours=[];let contour=[];
  for(const pt of glyph.points){contour.push(pt);if(pt.lastPointOfContour){contours.push(contour);contour=[];}}
  const commands=[];
  for(const points of contours) {
    const first=points.findIndex(pt=>pt.onCurve);
    const start=first>=0?points[first]:{x:(points.at(-1).x+points[0].x)/2,y:(points.at(-1).y+points[0].y)/2};
    commands.push({type:'M',x:start.x,y:start.y});
    const ordered=first>=0?[...points.slice(first+1),...points.slice(0,first+1)]:points;
    for(let i=0;i<ordered.length;i++) {
      const curr=ordered[i],next=ordered[(i+1)%ordered.length];
      if(curr.onCurve) { if(i<ordered.length-1)commands.push({type:'L',x:curr.x,y:curr.y}); }
      else {const end=next.onCurve?next:{x:(curr.x+next.x)/2,y:(curr.y+next.y)/2};commands.push({type:'Q',x1:curr.x,y1:curr.y,x:end.x,y:end.y});}
    }
    commands.push({type:'Z'});
  }
  return commands;
}
export function generate(font,text,p) {
  for(const k of ['pageWidth','pageHeight','textWidth','fontSize','lineHeight','strokeWidth'])if(!Number.isFinite(p[k]) || p[k]<=0)throw new Error('Maße und Abstände müssen größer als 0 sein.');
  for(const k of ['x','y','paragraphGap'])if(!Number.isFinite(p[k]) || p[k]<0)throw new Error('Position und Absatzabstand dürfen nicht negativ sein.');
  if(p.pageWidth>2000 || p.pageHeight>2000 || p.textWidth>2000 || p.fontSize>100)throw new Error('Bitte kleinere Maße wählen (Seite bis 2000 mm, Schrift bis 100 mm).');
  if(text.length>10000)throw new Error('Bitte höchstens 10.000 Zeichen verwenden.');
  const hasChar=ch=>font.charToGlyphIndex(ch)>0;
  const scale=p.fontSize/font.unitsPerEm,cache=new Map(),warnings=new Set(),adv=ch=>hasChar(ch)?(font.charToGlyph(ch).advanceWidth||0)*scale:0;
  const measure=s=>Array.from(s).reduce((n,c)=>n+adv(c),0);
  const wrap=raw=>{if(!p.wrap || !raw)return [raw];const words=raw.split(' '),out=[];let cur='';
    for(const word of words) { const cand=cur?cur+' '+word:word;if(!cur || measure(cand)<=p.textWidth)cur=cand;else {out.push(cur);cur=word;} }
    if(cur)out.push(cur);return out;
  };
  const strokesFor=ch=> {
    if(cache.has(ch))return cache.get(ch);
    if(!hasChar(ch)) { warnings.add(`Fehlendes Zeichen: ${JSON.stringify(ch)}`);cache.set(ch,[]);return []; }
    let strokes=[];
    for(const contour of flatten(glyphCommands(font.charToGlyph(ch)))) {
      const retrace=retraces(contour);
      if(p.mode!=='outline' && !retrace)warnings.add(`Kontur von ${JSON.stringify(ch)} prüfen: kein eindeutiger Rückweg.`);
      const pts=p.mode==='script' || (p.mode==='auto' && retrace)?firstHalf(contour):clean(contour);
      const s=simplify(pts,Math.max(.3,.01/scale));if(s.length>=2)strokes.push(s);
    }
    if(strokes.length>1) { const mx=Math.max(...strokes.map(length));strokes=[...strokes.filter(s=>length(s)>=.2*mx),...strokes.filter(s=>length(s)<.2*mx)]; }
    cache.set(ch,strokes);return strokes;
  };
  const raw=text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n');if(raw.at(-1)==='')raw.pop();
  const lines=raw.flatMap(wrap),paths=[],baselines=[];let baseline=p.y,bounds=null;
  const addBounds=point=>{if(!bounds)bounds={minX:point[0],maxX:point[0],minY:point[1],maxY:point[1]};else {bounds.minX=Math.min(bounds.minX,point[0]);bounds.maxX=Math.max(bounds.maxX,point[0]);bounds.minY=Math.min(bounds.minY,point[1]);bounds.maxY=Math.max(bounds.maxY,point[1]);}};
  for(const line of lines) { if(!line) { baseline+=p.paragraphGap;continue; }baselines.push(baseline);let x=p.x;
    if(measure(line)>p.textWidth+1e-6)warnings.add('Mindestens eine Zeile ist breiter als die Textbreite (ggf. ein langes Wort).');
    for(const ch of line) { if(ch===' '){x+=adv(ch);continue;}
      for(const stroke of strokesFor(ch)) { const pts=stroke.map(([gx,gy])=>[x+gx*scale,baseline-gy*scale]);pts.forEach(addBounds);paths.push('M '+pts.map(point=>point.map(num).join(',')).join(' L ')); }
      x+=adv(ch);
    }baseline+=p.lineHeight;
  }
  const half=p.strokeWidth/2;
  if(bounds && (bounds.minX-half<0 || bounds.minY-half<0 || bounds.maxX+half>p.pageWidth || bounds.maxY+half>p.pageHeight))warnings.add('Text läuft über den Papierrand. Position, Schriftgröße oder Abstände anpassen.');
  if(bounds && bounds.maxX+half>p.x+p.textWidth+1e-6)warnings.add('Ein Strich ragt über die eingestellte Textbreite.');
  if(p.mode==='outline')warnings.add('Konturmodus: normale Schriften werden als Umrisse gezeichnet, nicht als Einzelstriche.');
  const markup=`<g id="DRAW" fill="none" stroke="#000000" stroke-width="${num(p.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round">\n${paths.map(d=>`  <path d="${d}"/>`).join('\n')}\n</g>`;
  const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${p.pageWidth.toFixed(3)}mm" height="${p.pageHeight.toFixed(3)}mm" viewBox="0 0 ${p.pageWidth.toFixed(3)} ${p.pageHeight.toFixed(3)}">\n${markup}\n</svg>\n`;
  return {svg,markup,warnings:[...warnings],bounds,baselines,lineCount:baselines.length,pathCount:paths.length};
}
