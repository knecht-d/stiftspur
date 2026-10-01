import assert from 'node:assert/strict';import fs from 'node:fs';
import {exportDocument,pixelsPerMillimetre as scale} from '../dist/export.mjs';
import {generateTextDocument} from '../dist/layout.mjs';import {builtInFonts,strokeFont} from '../dist/fonts.mjs';import {handwritingVariation} from '../dist/handwriting.mjs';
const parse=s=>[...s.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m=>m[1]);
const parts=d=>d.split(/\bM\s+/).filter(Boolean).map(part=>[...part.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>[+m[1],+m[2]]));
let count=0;
for(const info of builtInFonts){const font=strokeFont(JSON.parse(fs.readFileSync(new URL(`../dist/fonts/${info.id}.json`,import.meta.url))));
 for(const [pageWidth,pageHeight] of [[148,105],[105,148]]){
  const p={pageWidth,pageHeight,left:12,right:12,top:12,bottom:12,strokeWidth:.4,fontSize:5,fontAuto:true,lineHeight:7,lineAuto:true,lineWeight:100,paragraphGap:2.5,gapAuto:true,gapWeight:100,wrap:true,mode:'auto',seed:42,opticalSpacing:50,variation:handwritingVariation(100)};
  const r=generateTextDocument(font,[{text:'Lieber Pascal,\nVielen Dank für den Tipp!\nGrüße aus Lobbach.',align:'center'}],p),out=exportDocument(r,p.strokeWidth),paths=parse(out.svg);
  assert.equal(paths.length,1);assert.ok(!/<g\b|transform=|<rect\b|<text\b|[\s]Z[\s"]/.test(out.svg));
  const subpaths=parts(paths[0]);assert.equal(subpaths.length,r.strokes.length);
  subpaths.forEach((points,i)=>{assert.equal(points.length,r.strokes[i].length);points.forEach(([x,y],j)=>{assert.ok(Math.abs(x/scale+r.bounds.minX-p.strokeWidth/2-r.strokes[i][j][0])<.00001);assert.ok(Math.abs(y/scale+r.bounds.minY-p.strokeWidth/2-r.strokes[i][j][1])<.00001);});});
  const w=Number(out.svg.match(/width="([\d.]+)px"/)[1]),h=Number(out.svg.match(/height="([\d.]+)px"/)[1]);
  assert.ok(Math.abs(w/scale-(out.width+p.strokeWidth))<.00001);assert.ok(Math.abs(h/scale-(out.height+p.strokeWidth))<.00001);
  assert.match(out.svg,new RegExp(`viewBox="0 0 ${w.toFixed(5).replaceAll('.','\\.')} ${h.toFixed(5).replaceAll('.','\\.')}"`));
  const all=subpaths.flat(),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);assert.ok(Math.abs((Math.max(...xs)-Math.min(...xs))/scale-out.width)<.00001);assert.ok(Math.abs((Math.max(...ys)-Math.min(...ys))/scale-out.height)<.00001);
  assert.equal(exportDocument(r,p.strokeWidth,'standard').svg,r.svg);count++;
 }
}
assert.equal(exportDocument(null,.4),null);
for(const strokes of [[[[0,0],[10,0]]],[[[0,0],[0,10]]]]){const flat=strokes.flat(),xs=flat.map(p=>p[0]),ys=flat.map(p=>p[1]);const r={bounds:{minX:0,minY:0,maxX:Math.max(...xs),maxY:Math.max(...ys)},strokes};const out=exportDocument(r,.4);assert.ok(!/NaN|Infinity/.test(out.svg));assert.ok(Number(out.svg.match(/height="([\d.]+)px"/)[1])>0);}
console.log(`Cricut export: ${count} font/paper cases preserve every pen stroke and coordinate; one compound object, 96 px/in size, no extra connections, standard export and degenerate dimensions passed.`);
