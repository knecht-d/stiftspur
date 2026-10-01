// SVG user units are CSS pixels: 96 px = 1 inch = 25.4 mm.
// Bake units and translation into coordinates, without nested transforms.
export const pixelsPerMillimetre=96/25.4;
export function exportDocument(result,strokeWidth,mode='cricut'){
 if(!['cricut','standard'].includes(mode))throw new Error('Unbekanntes Exportformat.');
 if(!result?.bounds||!result.strokes?.length)return null;
 const {minX,minY,maxX,maxY}=result.bounds;
 const width=maxX-minX,height=maxY-minY;
 if(mode==='standard')return {svg:result.svg,width,height,filename:'stiftspur-stiftpfade.svg'};
 const scale=pixelsPerMillimetre,padding=strokeWidth/2;
 const pageWidth=(width+strokeWidth)*scale,pageHeight=(height+strokeWidth)*scale;
 // A new M starts each pen stroke. Never join separate strokes with L or Z.
 const d=result.strokes.map(stroke=>'M '+stroke.map(([x,y])=>`${((x-minX+padding)*scale).toFixed(5)},${((y-minY+padding)*scale).toFixed(5)}`).join(' L ')).join(' ');
 const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${pageWidth.toFixed(5)}px" height="${pageHeight.toFixed(5)}px" viewBox="0 0 ${pageWidth.toFixed(5)} ${pageHeight.toFixed(5)}">\n<desc>Stiftspur. Set operation to Draw / Pen in Cricut Design Space. Path bounds: ${width.toFixed(3)} x ${height.toFixed(3)} mm. Paper and guides are not included.</desc>\n<path id="stiftspur-text" fill="none" stroke="#000000" stroke-width="${(strokeWidth*scale).toFixed(5)}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>\n</svg>\n`;
 return {svg,width,height,filename:'stiftspur-cricut.svg'};
}
