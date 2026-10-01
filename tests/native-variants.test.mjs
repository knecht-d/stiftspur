import assert from 'node:assert/strict';import fs from 'node:fs';
import {strokeFont,nativeVariantIndex} from '../dist/fonts.mjs';import {wordContexts,handwritingVariation} from '../dist/handwriting.mjs';import {generateTextDocument} from '../dist/layout.mjs';import {variantPreviews} from '../dist/variant-preview.mjs';import {exportDocument} from '../dist/export.mjs';
const font=id=>strokeFont(JSON.parse(fs.readFileSync(new URL(`../dist/fonts/${id}.json`,import.meta.url))));
const relief=font('Relief'),mistral=font('Mistral'),neato=font('EMSNeato');
assert.deepEqual(Object.keys(neato.nativeVariants),[]);assert.equal(mistral.nativeVariants.e.length,2);assert.equal(mistral.nativeVariants['ä'].length,1);
for(const ch of ['g','l','y'])assert.equal(relief.nativeVariants[ch].length,1);
for(const f of [relief,mistral])for(const ch of Object.keys(f.nativeVariants)){
 const base=f.getStrokeGlyph(ch);assert.ok(base);for(const alt of f.nativeVariants[ch]){assert.ok(alt.strokes.length);assert.notDeepEqual(alt.strokes,base.strokes);assert.ok(alt.advance>0);}
 const contexts=wordContexts(ch.repeat(24),42),previous=new Map(),choices=contexts.map(ctx=>nativeVariantIndex(f,ch,100,ctx,previous));
 for(let i=1;i<choices.length;i++)assert.notEqual(choices[i],choices[i-1]);
 assert.equal(new Set(choices).size,f.nativeVariants[ch].length+1);
 assert.ok(contexts.every(ctx=>nativeVariantIndex(f,ch,0,ctx,new Map())===0));
 const previews=variantPreviews(f,ch);assert.equal(previews.length,f.nativeVariants[ch].length+1);assert.equal(new Set(previews.map(p=>p.svg.match(/viewBox="([^"]+)"/)[1])).size,1);assert.equal(new Set(previews.map(p=>p.svg)).size,previews.length);
}
const p={pageWidth:148,pageHeight:105,left:12,right:12,top:12,bottom:12,strokeWidth:.4,fontSize:5,fontAuto:true,lineHeight:7,lineAuto:true,lineWeight:100,paragraphGap:2.5,gapAuto:true,gapWeight:100,wrap:true,mode:'auto',seed:42,opticalSpacing:30,variation:handwritingVariation(0)};
const vhs=font('VHSHand');
assert.equal(Object.keys(vhs.nativeVariants).length,78);
for(const [ch,alternatives] of Object.entries(vhs.nativeVariants)){
 assert.equal(alternatives.length,6);
 const shapes=[vhs.getStrokeGlyph(ch),...alternatives].map(g=>JSON.stringify(g.strokes));
 assert.equal(new Set(shapes).size,7,`VHS ${ch}: distinct recordings`);
}
assert.equal(variantPreviews(vhs,'a').length,7);
assert.equal(vhs.getStrokeGlyph('Y'),null);
const missing=generateTextDocument(vhs,[{text:'Y€:',align:'left'}],{...p,nativeStrength:100});
assert.ok(missing.warnings.some(w=>w.includes('Fehlende Zeichen')&&w.includes('Y')&&w.includes('€')&&w.includes(':')));
const taps=generateTextDocument(vhs,[{text:'..............',align:'left'}],{...p,nativeStrength:100});
assert.ok(taps.strokes.length>=14);assert.ok(taps.strokes.every(s=>s.length>=2));assert.ok(!/NaN|Infinity/.test(taps.svg));
const point=vhs.getStrokeGlyph('.',6).strokes[0];assert.equal(point.length,2);assert.deepEqual(point[0],point[1]);
const vhsOriginal=generateTextDocument(vhs,[{text:'Bananen, Kaffee und Grüße!',align:'left'}],{...p,nativeStrength:0});
const vhsVaried=generateTextDocument(vhs,[{text:'Bananen, Kaffee und Grüße!',align:'left'}],{...p,nativeStrength:100});
assert.notEqual(vhsOriginal.svg,vhsVaried.svg);assert.ok(vhsVaried.fits);
assert.equal((exportDocument(vhsVaried,.4).svg.match(/\bM /g)||[]).length,vhsVaried.strokes.length);
const text=[{text:'eeee aaaa ääää kkkk qqqq gggg llll yyyy Grüße\nLieber Pascal, vielen lieben Dank!',align:'left'}];
// Regression for the report that only e changes: isolate each base character.
for(const ch of ['a','ä','e','k','q','&']){
 const repeated=[{text:ch.repeat(12),align:'left'}];
 assert.notEqual(generateTextDocument(mistral,repeated,{...p,fontAuto:false,nativeStrength:0}).markup,generateTextDocument(mistral,repeated,{...p,fontAuto:false,nativeStrength:100}).markup,`Mistral ${ch} must change in the actual document`);
}
for(const f of [relief,mistral]){
 const original=generateTextDocument(f,text,{...p,nativeStrength:0});assert.equal(original.svg,generateTextDocument(f,text,p).svg);
 const native=generateTextDocument(f,text,{...p,nativeStrength:100});assert.notEqual(native.svg,original.svg);assert.equal(native.svg,generateTextDocument(f,text,{...p,nativeStrength:100}).svg);
 assert.notEqual(native.svg,generateTextDocument(f,text,{...p,nativeStrength:100,seed:101}).svg);
 for(const [pageWidth,pageHeight] of [[148,105],[105,148]])for(const level of [0,35,100]){
  const r=generateTextDocument(f,text,{...p,pageWidth,pageHeight,nativeStrength:100,variation:handwritingVariation(level)});assert.ok(r.fits);assert.ok(!r.warnings.some(w=>w.includes('Fehlende')));const exported=exportDocument(r,.4);assert.equal((exported.svg.match(/<path /g)||[]).length,1);assert.equal((exported.svg.match(/\bM /g)||[]).length,r.strokes.length);
 }
}
assert.equal(generateTextDocument(neato,text,{...p,nativeStrength:100}).svg,generateTextDocument(neato,text,{...p,nativeStrength:0}).svg);
assert.throws(()=>generateTextDocument(relief,text,{...p,nativeStrength:101}),/Buchstabenvarianten/);
console.log(`Native variants: Relief ${Object.keys(relief.nativeVariants).length} characters; Mistral ${Object.keys(mistral.nativeVariants).length} characters / ${Object.values(mistral.nativeVariants).flat().length} alternatives. Exact source glyphs, same-scale gallery, alternation, zero setting, deterministic choice, cache switching, fit and export passed.`);
