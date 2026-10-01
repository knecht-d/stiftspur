import {generateTextDocument,handwritingVariation} from './layout.mjs';

// The same pen paths as the document, with all variations disabled.
export function fontPreview(font,text='Wörter und Zeichen'){
 const result=generateTextDocument(font,[{text,align:'left'}],{pageWidth:100,pageHeight:30,left:1,right:1,top:1,bottom:1,strokeWidth:.065,fontSize:3,fontAuto:false,lineHeight:5,lineAuto:false,paragraphGap:0,gapAuto:false,wrap:false,mode:'auto',seed:42,nativeStrength:0,variation:handwritingVariation(0)});
 const b=result.bounds;if(!b)return '';
 const pad=.45,width=Math.max(1,b.maxX-b.minX)+2*pad,height=Math.max(3.7,b.maxY-b.minY)+2*pad;
 const x=b.minX-pad,y=(b.minY+b.maxY-height)/2;
 const label=text.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" role="img" aria-label="${label}">${result.markup.replace(' id="DRAW"','')}</svg>`;
}
