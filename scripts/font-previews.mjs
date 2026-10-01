import fs from 'node:fs';
import {builtInFonts,strokeFont} from '../dist/fonts.mjs';
import {fontPreview} from '../dist/font-preview.mjs';
import {samples} from '../dist/i18n.mjs';
const root=new URL('../dist/fonts/',import.meta.url);
fs.mkdirSync(new URL('previews/',root),{recursive:true});
for(const entry of builtInFonts){
 const font=strokeFont(JSON.parse(fs.readFileSync(new URL(entry.id+'.json',root),'utf8')));
 for(const [language,text] of Object.entries(samples))fs.writeFileSync(new URL(`previews/${entry.id}-${language}.svg`,root),fontPreview(font,text));
 fs.rmSync(new URL('previews/'+entry.id+'.svg',root),{force:true});
}
console.log(`Created ${builtInFonts.length*Object.keys(samples).length} font previews.`);
