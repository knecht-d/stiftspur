import assert from 'node:assert/strict';
import fs from 'node:fs';
import {naturalGlyph,wordContexts,variationKeys,handwritingVariation} from '../dist/handwriting.mjs';
import {strokeFont,builtInFonts} from '../dist/fonts.mjs';
import {generateTextDocument as generate} from '../dist/layout.mjs';
const zero=handwritingVariation(0),full=Object.fromEntries(variationKeys.map(k=>[k,100]));
const base={pageWidth:148,pageHeight:105,left:12,right:12,top:12,bottom:12,strokeWidth:.4,fontSize:5,fontAuto:true,lineHeight:7,lineAuto:true,lineWeight:100,paragraphGap:2.5,gapAuto:true,gapWeight:100,wrap:true,mode:'auto',seed:42,opticalSpacing:40,variation:handwritingVariation(35)};
const fontData=Object.fromEntries(builtInFonts.map(info=>[info.id,JSON.parse(fs.readFileSync(new URL(`../dist/fonts/${info.id}.json`,import.meta.url)))]));
const contexts=wordContexts('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',42);
assert.equal(new Set(contexts.map(c=>c.variant)).size,4);
for(let i=1;i<contexts.length;i++)assert.notEqual(contexts[i].variant,contexts[i-1].variant);
assert.deepEqual(contexts,wordContexts('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',42));
assert.notDeepEqual(contexts,wordContexts('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',77));
const e=fontData.Relief.glyphs.e;
assert.deepEqual(naturalGlyph(e,'e',1000,contexts[0],zero).strokes,e.strokes.map(s=>s.map(([x,y])=>[x/1000,-y/1000])));
// Shared endpoints of separate strokes must remain shared under deformation.
const junction={advance:600,strokes:[[[0,0],[300,500]],[[300,500],[600,0]],[[300,500],[300,700]]]};
for(const ctx of contexts){const g=naturalGlyph(junction,'A',1000,ctx,full);assert.deepEqual(g.strokes[0].at(-1),g.strokes[1][0]);assert.deepEqual(g.strokes[0].at(-1),g.strokes[2][0]);}
// The three knot gesture is shared; residual-free neighbours have a smooth baseline.
const flowOnly={...zero,flow:100},flow=contexts.map(ctx=>naturalGlyph(e,'e',1000,ctx,flowOnly));
for(let i=1;i<flow.length;i++)assert.ok(Math.abs(flow[i].baselineOffset-flow[i-1].baselineOffset)<.014);
// All four forms differ even with flow, rhythm and residual noise disabled.
const shapes=new Set([0,1,2,3].map(variant=>JSON.stringify(naturalGlyph(e,'e',1000,{...contexts[0],variant},{...zero,form:100}).strokes)));
assert.equal(shapes.size,4);
let checks=0;
const paragraphs=[{text:'Lieber Pascal,',align:'left'},{text:'',align:'left'},{text:'Vielen lieben Dank für deinen Tipp! Immer wieder schöne Grüße. ÄÖÜ äöü ß 0123456789. '.repeat(3),align:'justify'},{text:'Daniel',align:'right'}];
for(const info of builtInFonts){
 const data=fontData[info.id],font=strokeFont(data);
 for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,!?€'){
  if(info.id==='VHSHand'&&'Y€'.includes(ch)){assert.equal(font.getStrokeGlyph(ch),null);continue;}
  assert.ok(font.getStrokeGlyph(ch)?.strokes.length,`${info.id}: ${ch}`);
 }
 const normal=generate(font,paragraphs,{...base,variation:zero});
 assert.equal(normal.svg,generate(font,paragraphs,{...base,variation:zero,seed:101}).svg);
 assert.equal(normal.svg,generate(font,paragraphs,{...base,variation:zero,mode:'script'}).svg);
 const active=generate(font,paragraphs,base);
 assert.equal(active.svg,generate(font,paragraphs,base).svg);
 assert.notEqual(active.svg,normal.svg);
 assert.equal(active.pathCount,normal.pathCount);
 assert.ok(!active.warnings.length,`${info.id}: ${active.warnings}`);
 assert.equal(generate(font,[{text:'Grüße',align:'left'}],base).svg,generate(font,[{text:'Gru\u0308ße',align:'left'}],base).svg);
 for(const [pageWidth,pageHeight] of [[148,105],[105,148]])for(const variation of [zero,base.variation,full])for(const opticalSpacing of [0,100]){
  const p={...base,pageWidth,pageHeight,variation,opticalSpacing},r=generate(font,paragraphs,p),b=r.bounds,half=p.strokeWidth/2;
  assert.ok(r.fits,info.id);assert.ok(b.minX>=p.left+half-1e-6);assert.ok(b.maxX<=pageWidth-p.right-half+1e-6);assert.ok(b.minY>=p.top+half-1e-6);assert.ok(b.maxY<=pageHeight-p.bottom-half+1e-6);assert.ok(!/NaN|Infinity|<text/.test(r.svg));checks++;
 }
 for(const key of variationKeys){const p={...base,fontAuto:false,variation:{...zero,[key]:70}},text=[{text:'immer wieder',align:'left'}];assert.notEqual(generate(font,text,p).svg,generate(font,text,{...p,variation:zero}).svg);}
 const bad=generate(font,[{text:'Test 🐈',align:'left'}],base);assert.ok(bad.warnings.some(w=>w.includes('🐈')));
}
console.log(`Natural handwriting: four related forms, repeated letters, shared junctions, smooth word gesture, zero stability, NFC, all fonts and ${checks} fit/optical cases passed.`);
