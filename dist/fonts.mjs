export const builtInFonts=[
 {id:'EMSNeato',name:'EMS Neato',group:'Natürlich',description:'Ruhige, leicht geneigte Handschrift. Unser Startpunkt für persönliche Texte.'},
 {id:'EMSCasualHand',name:'EMS Casual Hand',group:'Natürlich',description:'Lockere, aufrechte Handschrift mit einem etwas markanteren Charakter.'},
 {id:'EMSDelight',name:'EMS Delight',group:'Natürlich',description:'Weiche, runde Druckhandschrift. Ruhig und gut lesbar für längere Texte.'},
 {id:'EMSPancakes',name:'EMS Pancakes',group:'Natürlich',description:'Breite, leicht verspielte Druckbuchstaben mit einem lockeren Rhythmus.'},
 {id:'Mistral',name:'Mistral SingleLine',group:'Natürlich',native:true,description:'Lebendige Schreibschrift mit echten Alternativzeichnungen, unter anderem für a, ä, e, k und q.'},
 {id:'VHSHand',name:'VHS Hand · experimentell',group:'Natürlich',native:true,description:'Ungezwungene Handschrift mit sieben aufgezeichneten Formen je Zeichen. Umlaute und ß vorhanden; großes Y und einige Sonderzeichen fehlen.'},
 {id:'EMSTech',name:'EMS Tech',group:'Klar & technisch',description:'Handgezeichnete Druckbuchstaben im Stil einer Architekturzeichnung.'},
 {id:'Relief',name:'Relief SingleLine',group:'Klar & technisch',native:true,description:'Klare, sachliche Buchstaben. Echte Alternativzeichnungen für g, l und y sowie ihre Akzentformen.'},
 {id:'EMSReadability',name:'EMS Readability',group:'Klar & technisch',description:'Unaufgeregte, gut lesbare Druckschrift. Eine sachliche Basis für sanfte Formvarianten.'},
 {id:'EMSNixish',name:'EMS Nixish',group:'Klar & technisch',description:'Geometrische Buchstaben mit feinen Serifen und einem Hauch Schreibmaschine.'},
 {id:'EMSLeague',name:'EMS League',group:'Kreativ',description:'Schwungvolle Schreibschrift mit Schleifen. Für kurze Grüße und Überschriften.'},
 {id:'EMSCapitol',name:'EMS Capitol',group:'Kreativ',description:'Fließende, schmale Schreibschrift mit eleganten Oberlängen.'},
 {id:'EMSAllure',name:'EMS Allure',group:'Kreativ',description:'Elegante Schreibschrift mit schwungvollen Großbuchstaben.'},
 {id:'EMSFelix',name:'EMS Felix',group:'Kreativ',description:'Kalligrafisch geprägte, geneigte Buchstaben. Für ausdrucksstarke kurze Texte.'}
];
export function strokeFont(data){
 if(!data?.unitsPerEm||!data.glyphs||!Object.hasOwn(data.glyphs,' '))throw new Error('Unlesbare Stiftschrift.');
 // Several SVG fonts use generic ascent/descent metadata. Measure actual ink.
 const y=Array.from('ÄÖÜHgjpqyß').flatMap(ch=>(data.glyphs[ch]?.strokes||[]).flatMap(s=>s.map(p=>p[1])));
 const lineHeightRatio=Math.max(6.2/4.2,(Math.max(...y)-Math.min(...y))/data.unitsPerEm+.22);
 const nativeVariants=data.nativeVariants||{};
 return {unitsPerEm:data.unitsPerEm,lineHeightRatio,name:data.name,nativeVariants,
  getStrokeGlyph(ch,variant=0){const glyph=variant?nativeVariants[ch]?.[variant-1]:data.glyphs[ch];return glyph?{...glyph,missing:false,unclear:false}:null;}
 };
}
export function nativeVariantIndex(font,ch,strength,context,previous){
 const count=font.nativeVariants?.[ch]?.length||0;
 let index=0;
 if(count&&strength>0&&context.noise/4294967296<strength/100){
  // Include the original in the family. At 100%, repeated letters always
  // alternate, even when the font has only one additional drawing.
  index=context.noise%(count+1);
  if(index===previous.get(ch))index=(index+1+((context.noise>>>8)%count))%(count+1);
 }
 previous.set(ch,index);return index;
}
const cache=new Map();
export async function loadBuiltInFont(id){
 if(!builtInFonts.some(f=>f.id===id))throw new Error('Unbekannte Schrift.');
 if(!cache.has(id)){
  const loading=fetch(new URL(`./fonts/${id}.json`,import.meta.url)).then(response=>{if(!response.ok)throw new Error('Die Schrift konnte nicht geladen werden.');return response.json();}).then(strokeFont).catch(error=>{cache.delete(id);throw error;});
  cache.set(id,loading);
 }
 return cache.get(id);
}
