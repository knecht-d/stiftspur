import {flatten,glyphCommands,retraces,firstHalf,clean,length,simplify} from './engine.mjs';
import {inkProfile,opticalGlyphs} from './optical.mjs';
import {variationKeys,handwritingVariation,wordContexts,naturalGlyph} from './handwriting.mjs';
import {nativeVariantIndex} from './fonts.mjs';
export {variationKeys,handwritingVariation} from './handwriting.mjs';
const fonts=new WeakMap();
function boundsOf(strokes){let b=null;for(const stroke of strokes)for(const [x,y] of stroke){if(!b)b={minX:x,minY:y,maxX:x,maxY:y};else {b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y);}}return b;}
function rawGlyph(font,ch,mode,variant=0){
 let cache=fonts.get(font);if(!cache){cache=new Map();fonts.set(font,cache);}const key=mode+'\0'+ch+'\0'+variant;if(cache.has(key))return cache.get(key);
 if(font.getStrokeGlyph){const g=font.getStrokeGlyph(ch,variant)||{advance:0,strokes:[],missing:true,unclear:false};cache.set(key,g);return g;}
 if(!(font.charToGlyphIndex(ch)>0)){const g={advance:0,strokes:[],missing:true,unclear:false};cache.set(key,g);return g;}
 const glyph=font.charToGlyph(ch);let unclear=false,strokes=[];
 for(const contour of flatten(glyphCommands(glyph))){const retrace=retraces(contour);unclear ||= !retrace;const p=mode==='script'||(mode==='auto'&&retrace)?firstHalf(contour):clean(contour);if(p.length>=2)strokes.push(p);}
 if(strokes.length>1){const mx=Math.max(...strokes.map(length));strokes=[...strokes.filter(p=>length(p)>=mx*.2),...strokes.filter(p=>length(p)<mx*.2)];}
 const g={advance:glyph.advanceWidth||0,strokes,unclear,missing:false};cache.set(key,g);return g;
}
export function fontSizeForPen(strokeWidth,weight){
 if(!Number.isFinite(weight)||weight<25||weight>300)throw new Error('Größenfaktor zwischen 25 und 300 % wählen.');
 return strokeWidth*10.5*weight/100;
}
function character(font,ch,index,p,context){
 const raw=rawGlyph(font,ch,p.mode,context.nativeVariant),g=naturalGlyph(raw,ch,font.unitsPerEm,context,p.variation);
 return {...g,ch,index,profile:p.opticalSpacing?inkProfile(g.strokes,g.baselineOffset):null,bounds:boundsOf(g.strokes),missing:raw.missing,unclear:raw.unclear};
}
function prepare(font,paragraphs,p){let index=0,segmentId=0;return paragraphs.map((paragraph,paragraphIndex)=>({align:paragraph.align,paragraphIndex,segments:paragraph.text.normalize('NFC').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n').map(segment=>{const contexts=wordContexts(segment,p.seed,segmentId++),previous=new Map();return Array.from(segment).map((ch,i)=>character(font,ch,index++,p,{...contexts[i],nativeVariant:nativeVariantIndex(font,ch,p.nativeStrength||0,contexts[i],previous)}));})}));}
function spacing(size,p){return {lineHeight:p.lineAuto?size*(p.lineHeightRatio||6.2/4.2)*p.lineWeight/100:p.lineHeight,paragraphGap:p.gapAuto?size*(2.5/4.2)*p.gapWeight/100:p.paragraphGap};}
export function drawingArea(p){
 for(const key of ['pageWidth','pageHeight','strokeWidth'])if(!Number.isFinite(p[key])||p[key]<=0)throw new Error('Gültige Papiermaße und eine Stiftbreite größer als 0 wählen.');
 if(p.pageWidth>2000||p.pageHeight>2000||p.strokeWidth>5)throw new Error('Papiermaße bis 2000 mm und Stiftbreite bis 5 mm wählen.');
 for(const key of ['left','right','top','bottom'])if(!Number.isFinite(p[key])||p[key]<0)throw new Error('Seitenränder müssen mindestens 0 mm sein.');
 const width=p.pageWidth-p.left-p.right,height=p.pageHeight-p.top-p.bottom;
 if(width<=p.strokeWidth||height<=p.strokeWidth)throw new Error('Die Seitenränder lassen keine ausreichende Zeichenfläche übrig. Bitte Ränder verkleinern.');
 return {x:p.left,y:p.top,width,height};
}
function layoutAt(prepared,size,p,area,probe=false){
 const available=area.width-p.strokeWidth,limit=available/size,lines=[];
 for(const paragraph of prepared)for(const original of paragraph.segments){
   const segment=opticalGlyphs(original,size,p.strokeWidth,p.opticalSpacing||0);
   const meta={align:paragraph.align,paragraphIndex:paragraph.paragraphIndex};
   if(!segment.length){lines.push({...meta,glyphs:[],last:true});continue;}
   if(!p.wrap){lines.push({...meta,glyphs:segment,last:true});continue;}
   let start=0;
   while(start<segment.length){let advance=0,end=start,space=-1;
     for(;end<segment.length;end++){if(segment[end].ch===' ')space=end;const width=segment[end].advance-(segment[end].tuck||0);if(advance+width>limit&&end>start)break;advance+=width;}
     if(end===segment.length){lines.push({...meta,glyphs:segment.slice(start),last:true});break;}
     if(space>start){lines.push({...meta,glyphs:segment.slice(start,space),last:false});start=space+1;}
     else{let wordEnd=end;while(wordEnd<segment.length&&segment[wordEnd].ch!==' ')wordEnd++;lines.push({...meta,glyphs:segment.slice(start,wordEnd),last:wordEnd===segment.length});start=wordEnd+1;}
   }
 }
 const {lineHeight,paragraphGap}=spacing(size,p);let baseline=0,firstBaseline=null;const strokes=[],lineInfo=[];
 for(const line of lines){
   if(!line.glyphs.length){baseline+=paragraphGap;continue;}
   let cursor=0;const placed=line.glyphs.map(g=>{cursor-=(g.tuck||0)*size;const x=cursor;cursor+=g.advance*size;
     const drift=g.baselineOffset*size;
     const source=probe?(g.bounds?[[[g.bounds.minX,g.bounds.minY],[g.bounds.maxX,g.bounds.maxY]]]:[]):g.strokes;
     return {...g,strokes:source.map(stroke=>stroke.map(([px,py])=>[px*size+x,py*size+baseline+drift]))};
   });
   const before=boundsOf(placed.flatMap(g=>g.strokes)),inkWidth=before?before.maxX-before.minX:0,spaces=placed.filter(g=>g.ch===' ').length;
   const justify=line.align==='justify'&&!line.last&&spaces>0&&inkWidth<available,extra=justify?(available-inkWidth)/spaces:0;
   const offset=before?-before.minX+(line.align==='right'?available-inkWidth:line.align==='center'?(available-inkWidth)/2:0):0;let added=0;const lineStrokes=[];
   for(const g of placed){if(g.ch===' '){added+=extra;continue;}for(const stroke of g.strokes)lineStrokes.push(stroke.map(([x,y])=>[x+offset+added,y]));}
   if(lineStrokes.length&&firstBaseline===null)firstBaseline=baseline;
   strokes.push(...lineStrokes);lineInfo.push({baseline,last:line.last,justified:justify,align:line.align,paragraphIndex:line.paragraphIndex,bounds:boundsOf(lineStrokes),strokes:probe?[]:lineStrokes});baseline+=lineHeight;
 }
 const leading=firstBaseline||0,bounds=boundsOf(strokes),height=bounds?bounds.maxY-bounds.minY+leading:0;
 const fits=!bounds||(bounds.minX>=-1e-7&&bounds.maxX<=available+1e-7&&height+p.strokeWidth<=area.height+1e-7);
 return {strokes,bounds,lineInfo,fits,height,lineHeight,paragraphGap,leading};
}
export function generateTextDocument(font,paragraphs,p){
 p={...p,lineHeightRatio:font.lineHeightRatio};
 if(p.nativeStrength!==undefined&&(!Number.isFinite(p.nativeStrength)||p.nativeStrength<0||p.nativeStrength>100))throw new Error('Echte Buchstabenvarianten zwischen 0 und 100 % wählen.');
 const area=drawingArea(p);if(paragraphs.map(p=>p.text).join('\n').length>10000)throw new Error('Bitte höchstens 10.000 Zeichen verwenden.');
 if(p.opticalSpacing!==undefined&&(!Number.isFinite(p.opticalSpacing)||p.opticalSpacing<0||p.opticalSpacing>100))throw new Error('Optischen Buchstabenabstand zwischen 0 und 100 % wählen.');
 for(const paragraph of paragraphs)if(!['left','center','right','justify'].includes(paragraph.align))throw new Error('Ungültige Absatz-Ausrichtung.');
 if(!p.fontAuto&&p.fontMode!=='pen'&&(!Number.isFinite(p.fontSize)||p.fontSize<=0||p.fontSize>100))throw new Error('Schriftgröße zwischen 0 und 100 mm wählen.');
 if(p.lineAuto?(!Number.isFinite(p.lineWeight)||p.lineWeight<25||p.lineWeight>300):(!Number.isFinite(p.lineHeight)||p.lineHeight<=0))throw new Error('Gültigen Zeilenabstand oder Faktor zwischen 25 und 300 % wählen.');
 if(p.gapAuto?(!Number.isFinite(p.gapWeight)||p.gapWeight<0||p.gapWeight>400):(!Number.isFinite(p.paragraphGap)||p.paragraphGap<0))throw new Error('Gültigen Leerzeilenabstand oder Faktor zwischen 0 und 400 % wählen.');
 for(const key of variationKeys)if(!Number.isFinite(p.variation[key])||p.variation[key]<0||p.variation[key]>100)throw new Error('Variationen zwischen 0 und 100 % wählen.');
 const prepared=prepare(font,paragraphs,p),warnings=[];let size=p.fontMode==='pen'?fontSizeForPen(p.strokeWidth,p.penWeight):p.fontSize;
 if(p.fontAuto){let low=.05,high=100;const minimum=layoutAt(prepared,low,p,area,true);
   if(minimum.fits){for(let n=0;n<22;n++){const mid=(low+high)/2;if(layoutAt(prepared,mid,p,area,true).fits)low=mid;else high=mid;}size=low;}
   else{size=low;warnings.push('Mit den festen Abständen passt der Text auch bei kleinster Schrift nicht in die Zeichenfläche. Abstände verkleinern oder automatisch bestimmen lassen.');}
 }
 const layout=layoutAt(prepared,size,p,area),top=layout.bounds?layout.leading-layout.bounds.minY:0,padding=p.strokeWidth/2;
 const final=layout.strokes.map(stroke=>simplify(stroke.map(([x,y])=>[x+area.x+padding,y+area.y+padding+top]),.01));
 const bounds=boundsOf(final),paths=final.map(stroke=>'M '+stroke.map(point=>point.map(v=>v.toFixed(4)).join(',')).join(' L '));
 if(!layout.fits)warnings.push('Text passt nicht vollständig in die Zeichenfläche. „Fläche füllen“ wählen, Schriftgröße oder Abstände verkleinern oder Seitenränder anpassen.');
 const glyphs=prepared.flatMap(p=>p.segments.flat()),missing=new Set(glyphs.filter(g=>g.missing).map(g=>g.ch)),unclear=new Set(glyphs.filter(g=>g.unclear).map(g=>g.ch));
 if(missing.size)warnings.push('Fehlende Zeichen: '+[...missing].map(c=>JSON.stringify(c)).join(', '));
 if(p.mode!=='outline'&&unclear.size)warnings.push('Konturen prüfen: '+[...unclear].map(c=>JSON.stringify(c)).join(', '));
 if(p.mode==='outline'&&!font.getStrokeGlyph)warnings.push('Konturmodus: Umrisse, keine Einzelstriche.');
 if(layout.lineInfo.some((line,i)=>i>0&&line.bounds&&layout.lineInfo[i-1].bounds&&line.bounds.minY-padding<layout.lineInfo[i-1].bounds.maxY+padding))warnings.push('Die Schriftbereiche benachbarter Zeilen überlappen sich. Bei Bedarf Zeilenabstand erhöhen oder Schreibfluss verringern.');
 const markup=`<g id="DRAW" fill="none" stroke="#000000" stroke-width="${p.strokeWidth.toFixed(4)}" stroke-linecap="round" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</g>`;
 const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${p.pageWidth.toFixed(3)}mm" height="${p.pageHeight.toFixed(3)}mm" viewBox="0 0 ${p.pageWidth} ${p.pageHeight}">\n${markup}\n</svg>\n`;
 return {svg,markup,strokes:final,bounds,area,warnings,pathCount:paths.length,lineCount:layout.lineInfo.length,fontSize:size,lineHeight:layout.lineHeight,paragraphGap:layout.paragraphGap,fits:layout.fits,baselines:layout.lineInfo.map(l=>l.baseline+area.y+padding+top),lineInfo:layout.lineInfo.map(({strokes,...line})=>line)};
}
