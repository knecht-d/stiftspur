import {generateTextDocument,drawingArea,variationKeys,handwritingVariation,fontSizeForPen} from './layout.mjs';
import {exportDocument} from './export.mjs';
import {variantPreviews} from './variant-preview.mjs';
import {fontPreview} from './font-preview.mjs';
import {RichEditor} from './editor.mjs';
import {builtInFonts,loadBuiltInFont} from './fonts.mjs';
import {language,setLanguage,t,translatePage,localizeMessage,samples,exampleText} from './i18n.mjs';
const $=id=>document.getElementById(id),numeric=['pageWidth','pageHeight','left','right','top','bottom','strokeWidth','fontSize','lineHeight','paragraphGap','lineWeight','gapWeight','penWeight','opticalSpacing','nativeStrength'];
const num=id=>$(id).value.trim()===''?NaN:Number($(id).value),format=n=>Number(n.toFixed(2)).toLocaleString(language==='de'?'de-DE':'en-US');
const fontName=entry=>entry.name.replace(' · experimentell','');
const originalDescriptions=new Map([...document.querySelectorAll('[aria-describedby]')].map(el=>[el,el.getAttribute('aria-describedby')]));
const defaults=lang=>exampleText[lang].map(text=>({text,align:'left'}));
let font=null,result=null,zoom=1,timer=null,loadId=0,seed=42,downloadURL=null,fontLoading=false,uploadedFont=null,uploadedName='',activeFontId='EMSNeato',activeVariantCharacter='';
let operationError=null,layoutMessages=[],layoutFailed=false,retryFont=null,noticeDismissed='',lastAlign='left';
function setDownload(svg=null){const link=$('download'),previous=downloadURL;downloadURL=svg?URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})):null;if(downloadURL)link.href=downloadURL;else link.removeAttribute('href');link.setAttribute('aria-disabled',String(!downloadURL));link.tabIndex=downloadURL?0:-1;if(previous)setTimeout(()=>URL.revokeObjectURL(previous),60000);}
const alignKeys={left:'alignLeft',center:'alignCenter',right:'alignRight',justify:'alignJustify'};
function selectionStatus(align){lastAlign=align;for(const button of $('align-toolbar').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.align===align));$('align-status').textContent=t(alignKeys[align]||'alignMixed');}
const editor=new RichEditor($('editor'),schedule,selectionStatus);editor.setParagraphs(defaults(language));
function fontMode(){return document.querySelector('input[name="font-mode"]:checked').value;}
function params(){return {...Object.fromEntries(numeric.map(k=>[k,num(k)])),fontMode:fontMode(),fontAuto:fontMode()==='fill',lineAuto:$('lineAuto').checked,gapAuto:$('gapAuto').checked,wrap:$('wrap').checked,mode:$('mode').value,seed,variation:handwritingVariation(num('natural'),Object.fromEntries(variationKeys.map(k=>[k,num('var-'+k)])))};}
function errorLocation(raw){
 if(/Seitenränder|Ränder/.test(raw))return {scope:'paper',fields:['left','right','top','bottom']};
 if(/Papiermaße|Stiftbreite größer/.test(raw))return {scope:'paper',fields:['pageWidth','pageHeight','strokeWidth']};
 if(/Fehlende Zeichen|10.000 Zeichen|Absatz-Ausrichtung/.test(raw))return {scope:'editor',fields:['editor']};
 if(/Buchstabenvarianten|Variationen/.test(raw))return {scope:'handwriting',fields:['nativeStrength','natural']};
 if(/Leerzeilenabstand/.test(raw))return {scope:'size',fields:['paragraphGap','gapWeight']};
 if(/Zeilenabstand/.test(raw))return {scope:'size',fields:['lineHeight','lineWeight']};
 if(/Größenfaktor/.test(raw))return {scope:'size',fields:['penWeight']};
 if(/Optischen/.test(raw))return {scope:'size',fields:['opticalSpacing']};
 return {scope:'size',fields:['fontSize']};
}
function renderNotices(){
 const grouped={font:[],paper:[],editor:[],size:[],handwriting:[]};
 for(const el of document.querySelectorAll('[aria-invalid="true"]')){el.removeAttribute('aria-invalid');if(originalDescriptions.has(el))el.setAttribute('aria-describedby',originalDescriptions.get(el));else el.removeAttribute('aria-describedby');}
 if(operationError)grouped[operationError.scope].push(t(operationError.key,operationError.args));
 for(const raw of layoutMessages){const {scope,fields}=errorLocation(raw);grouped[scope].push(localizeMessage(raw));if(layoutFailed){for(const id of fields){$(id)?.setAttribute('aria-invalid','true');$(id)?.setAttribute('aria-describedby',scope+'-error');}if(scope==='paper'&&fields.includes('left'))$('margin-details').open=true;}}
 for(const [scope,items] of Object.entries(grouped)){const box=$(scope+'-error');box.hidden=!items.length;box.textContent=items.join(' ');box.classList.toggle('warning',!layoutFailed&&scope!=='font'&&!(operationError?.scope===scope));}
 $('messages').replaceChildren();$('messages').hidden=!layoutMessages.length;$('messages').classList.toggle('error',layoutFailed);
 if(layoutMessages.length){const list=document.createElement('ul');for(const raw of layoutMessages){const li=document.createElement('li');li.textContent=localizeMessage(raw);list.append(li);}$('messages').append(list);}
 const modal=$('font-dialog'),fontError=operationError?.scope==='font'&&modal.open;
 $('font-dialog-error').hidden=!fontError;$('font-dialog-error').querySelector('p').textContent=fontError?t(operationError.key,operationError.args):'';$('font-retry').hidden=!retryFont;
 const signature=JSON.stringify([operationError,layoutFailed,layoutMessages]);
 const items=[...(operationError?[t(operationError.key,operationError.args)]:[]),...layoutMessages.map(localizeMessage)];
 if(!items.length)noticeDismissed='';
 $('notice').hidden=!items.length||signature===noticeDismissed||modal.open||$('help-dialog').open;
 $('notice-title').textContent=t(operationError||layoutFailed?'errorTitle':'warningTitle');$('notice-text').textContent=items.join(' ');$('notice').classList.toggle('warning',!operationError&&!layoutFailed);$('notice-retry').hidden=!retryFont;
}
$('notice-dismiss').addEventListener('click',()=>{noticeDismissed=JSON.stringify([operationError,layoutFailed,layoutMessages]);renderNotices();});
for(const id of ['notice-retry','font-retry'])$(id).addEventListener('click',()=>{if(retryFont)chooseFont(retryFont);});
function resize(p=params()){const stage=$('stage'),style=getComputedStyle(stage),padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),w=Number.isFinite(p.pageWidth)&&p.pageWidth>0?p.pageWidth:148,h=Number.isFinite(p.pageHeight)&&p.pageHeight>0?p.pageHeight:105;const scale=Math.min((stage.clientWidth-padding)/w,Math.max(220,stage.clientHeight-padding)/h);$('paper-wrap').style.width=Math.max(20,w*scale*zoom)+'px';$('paper-wrap').style.height=Math.max(20,h*scale*zoom)+'px';$('zoom-label').textContent=Math.round(zoom*100)+' %';}
function renderPreview(p,area){const w=Number.isFinite(p.pageWidth)&&p.pageWidth>0?p.pageWidth:148,h=Number.isFinite(p.pageHeight)&&p.pageHeight>0?p.pageHeight:105;$('preview').setAttribute('viewBox',`0 0 ${w} ${h}`);$('paper-size').textContent=`${format(w)} × ${format(h)} mm`;let guides='';if($('guides').checked&&area)guides=`<g aria-hidden="true" fill="none" stroke="#164bc4"><rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" stroke-width=".15" stroke-dasharray="1.2 1.2"/>${(result?.baselines||[]).map(y=>`<path d="M ${area.x} ${y} h ${area.width}" stroke-width=".08" opacity=".25"/>`).join('')}</g>`;$('preview').innerHTML=guides+(result?.markup||'');$('empty').hidden=Boolean(font);resize(p);}
function rangeFeedback(){for(const [id,output] of [['natural','value-natural'],['lineWeight','value-lineWeight'],['gapWeight','value-gapWeight'],['penWeight','value-penWeight'],['opticalSpacing','value-opticalSpacing'],['nativeStrength','value-nativeStrength']])$(output).textContent=$(id).value+' %';for(const key of variationKeys)$('value-'+key).textContent=$('var-'+key).value+' %';}
function automaticControls(){for(const [control,mode] of [['lineHeight','lineAuto'],['paragraphGap','gapAuto']])$(control).disabled=$(mode).checked;$('fontSize').disabled=fontMode()!=='manual';$('pen-factor').hidden=fontMode()!=='pen';$('line-factor').hidden=!$('lineAuto').checked;$('gap-factor').hidden=!$('gapAuto').checked;rangeFeedback();}
function update(){clearTimeout(timer);timer=null;const p=params(),paragraphs=editor.getParagraphs();$('char-count').textContent=`${paragraphs.map(p=>p.text).join('\n').length} / ${format(10000)}`;automaticControls();result=null;setDownload();layoutMessages=[];layoutFailed=false;$('export-size').textContent='';let area;
 try{area=drawingArea(p);$('area-size').textContent=t('area',{width:format(area.width),height:format(area.height)});
  if(!font){if(p.fontMode==='pen')$('fontSize').value=fontSizeForPen(p.strokeWidth,p.penWeight).toFixed(5);$('resolved-info').textContent='';$('status').textContent=fontLoading?t('fontLoading'):t('empty');renderNotices();renderPreview(p,area);return;}
  result=generateTextDocument(font,paragraphs,p);layoutMessages=result.warnings;refreshExport();$('stat-lines').textContent=result.lineCount;$('stat-paths').textContent=format(result.pathCount);$('stat-bounds').textContent=`${format(area.width)} × ${format(area.height)} mm`;$('status').textContent=fontLoading?t('fontLoading'):result.warnings.length?t('warnings',{count:result.warnings.length}):result.pathCount?t('ready'):t('typeText');
  $('resolved-info').textContent=t('resolved',{font:format(result.fontSize),line:format(result.lineHeight),gap:format(result.paragraphGap)});
  if(p.fontMode!=='manual')$('fontSize').value=result.fontSize.toFixed(5);if(p.lineAuto)$('lineHeight').value=result.lineHeight.toFixed(5);if(p.gapAuto)$('paragraphGap').value=result.paragraphGap.toFixed(5);
 }catch(e){layoutMessages=[e.message||t('generationFailed')];layoutFailed=true;$('status').textContent=t('invalid');$('stat-lines').textContent='–';$('stat-paths').textContent='–';$('stat-bounds').textContent='';$('resolved-info').textContent='';if(!area)$('area-size').textContent='';}
 renderNotices();renderPreview(p,area);
}
function refreshExport(){const output=exportDocument(result,num('strokeWidth'),$('export-mode').value);if(!output){setDownload();$('export-size').textContent=t('exportEmpty');return;}$('export-size').textContent=t('exportSize',{width:format(output.width/10),height:format(output.height/10)});$('download').download=output.filename;if(!fontLoading)setDownload(output.svg);else setDownload();}
$('export-mode').addEventListener('change',()=>{if(timer)update();else refreshExport();});
function schedule(){clearTimeout(timer);timer=setTimeout(update,150);}
function renderVariants(){
 $('variant-gallery').replaceChildren();if(!font)return;$('variant-gallery').classList.toggle('many-variants',(font.nativeVariants?.[activeVariantCharacter]?.length||0)>2);
 for(const button of $('variant-characters').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.character===activeVariantCharacter));
 variantPreviews(font,activeVariantCharacter).forEach((item,index)=>{const figure=document.createElement('figure'),caption=document.createElement('figcaption'),label=index?t('alternative',{number:index}):t('original');figure.innerHTML=item.svg;figure.querySelector('svg').setAttribute('aria-label',label);caption.textContent=label;figure.append(caption);$('variant-gallery').append(figure);});
}
function nativeControls(reset=false){
 const chars=Object.keys(font?.nativeVariants||{}),supported=chars.length>0;$('nativeStrength').disabled=!supported;$('native-details').hidden=!supported;$('variant-characters').replaceChildren();if(reset||!chars.includes(activeVariantCharacter))activeVariantCharacter=chars.includes('a')?'a':chars[0]||'';
 for(const ch of chars){const button=document.createElement('button');button.type='button';button.dataset.character=ch;button.textContent=ch;button.setAttribute('aria-label',t('variantCharacter',{character:ch}));button.addEventListener('click',()=>{activeVariantCharacter=ch;renderVariants();});$('variant-characters').append(button);}
 $('native-status').textContent=supported?t('nativeCount',{count:chars.length}):t('nativeNone');renderVariants();
}
function sampleImage(entry){const img=document.createElement('img');img.src=`fonts/previews/${entry.id}-${language}.svg`;img.alt=t('previewFont',{name:fontName(entry)});return img;}
function refreshFontUI(){
 const entry=builtInFonts.find(f=>f.id===activeFontId);$('selected-font-name').textContent=entry?fontName(entry):uploadedName;$('selected-font-preview').replaceChildren();if(entry)$('selected-font-preview').append(sampleImage(entry));else if(font)$('selected-font-preview').innerHTML=fontPreview(font,samples[language]);
 for(const button of $('font-cards').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.font===activeFontId));
 for(const id of ['font-status','font-dialog-status']){$(id).hidden=!fontLoading;$(id).textContent=fontLoading?t('fontLoading'):'';}
}
function fontReady(next,id){font=next;activeFontId=id;fontLoading=false;if(operationError?.scope==='font')operationError=null;retryFont=null;refreshFontUI();$('path-details').hidden=Boolean(next.getStrokeGlyph);nativeControls(true);if($('font-dialog').open)$('font-dialog').close();update();}
function fontFailed(id,key,args={},retry=null){if(id!==loadId)return;fontLoading=false;operationError={scope:'font',key,args};retryFont=retry;noticeDismissed='';refreshFontUI();update();}
async function chooseFont(value){
 const id=++loadId;if(operationError?.scope==='font')operationError=null;retryFont=null;
 if(value==='custom'&&uploadedFont){fontReady(uploadedFont,'custom');return;}
 fontLoading=true;setDownload();refreshFontUI();renderNotices();
 try{const next=await loadBuiltInFont(value);if(id===loadId)fontReady(next,value);}catch{fontFailed(id,'fontFailed',{name:fontName(builtInFonts.find(f=>f.id===value))},value);}
}
async function loadFont(file){
 if(!file)return;const id=++loadId;fontLoading=true;operationError=null;retryFont=null;setDownload();refreshFontUI();renderNotices();
 try{
  if(!/\.(ttf|otf)$/i.test(file.name))throw {key:'fontType'};
  if(file.size>15*1024*1024)throw {key:'fontLarge'};
  const bytes=await file.arrayBuffer(),next=window.opentype.parse(bytes);if(id!==loadId)return;
  if(!next.unitsPerEm||!next.glyphs?.length)throw {key:'fontUnreadable'};
  fontPreview(next,samples[language]);uploadedFont=next;uploadedName=file.name;buildFontCards();fontReady(next,'custom');
 }catch(e){fontFailed(id,e.key||'fontUnreadable');}finally{$('font').value='';}
}
function buildFontCards(){
 $('font-cards').replaceChildren();const groupKeys={'Natürlich':'groupNatural','Klar & technisch':'groupTechnical','Kreativ':'groupCreative'},groups=new Map();
 for(const entry of builtInFonts){let group=groups.get(entry.group);if(!group){group=document.createElement('section');group.className='font-group';const title=document.createElement('h3');title.textContent=t(groupKeys[entry.group]);group.append(title);groups.set(entry.group,group);$('font-cards').append(group);}const button=document.createElement('button');button.type='button';button.className='font-card';button.dataset.font=entry.id;button.setAttribute('aria-pressed',String(entry.id===activeFontId));button.setAttribute('aria-label',fontName(entry));const title=document.createElement('span');title.className='font-card-name';title.textContent=fontName(entry);button.append(title);const sample=document.createElement('span');sample.className='font-sample';sample.append(sampleImage(entry));button.append(sample);for(const key of [...(entry.native?['variantsBadge']:[]),...(entry.id==='VHSHand'?['experimental']:[])]){const badge=document.createElement('span');badge.className='font-badge';badge.textContent=t(key);button.append(badge);}button.addEventListener('click',()=>chooseFont(entry.id));group.append(button);}
 if(uploadedFont){const own=document.createElement('button');own.type='button';own.id='custom-font-card';own.className='font-card';own.dataset.font='custom';own.setAttribute('aria-pressed',String(activeFontId==='custom'));const title=document.createElement('span');title.className='font-card-name';title.textContent=uploadedName;const sample=document.createElement('span');sample.className='font-sample';sample.innerHTML=fontPreview(uploadedFont,samples[language]);own.append(title,sample);own.addEventListener('click',()=>chooseFont('custom'));$('font-cards').append(own);}
}
for(const prefix of ['font','help']){
 $(prefix+'-open').addEventListener('click',()=>{$(prefix+'-dialog').showModal();renderNotices();});
 $(prefix+'-close').addEventListener('click',()=>$(prefix+'-dialog').close());
 $(prefix+'-dialog').addEventListener('close',()=>{$(prefix+'-open').focus();renderNotices();});
}
function applyLanguage(){
 translatePage();document.title='Stiftspur · '+t('subtitle');document.querySelector('meta[name="description"]').content=exampleText[language].join(' ');$('language').value=language;
 for(const option of $('format').options){if(option.value==='custom')continue;const [w,h]=option.value.split(',').map(Number),size=w===210&&h===297?'A4':w===148&&h===105||w===105&&h===148?'A6':'A5';option.textContent=`${size} · ${t(w>h?'landscape':'portrait')} (${w} × ${h})`;}
 for(const option of $('pen').options)if(option.value!=='custom')option.textContent=format(Number(option.value))+' mm';
 for(const id of ['licenses-link','font-licenses-link'])$(id).href=`fonts/licenses.html?lang=${language}`;
 buildFontCards();refreshFontUI();nativeControls();selectionStatus(lastAlign);update();
}
$('language').addEventListener('change',()=>{const unchanged=JSON.stringify(editor.getParagraphs())===JSON.stringify(defaults(language));setLanguage($('language').value);if(unchanged)editor.setParagraphs(defaults(language));applyLanguage();});
for(const button of $('align-toolbar').querySelectorAll('button')){button.addEventListener('pointerdown',e=>e.preventDefault());button.addEventListener('click',()=>{editor.applyAlign(button.dataset.align);update();});}
$('font').addEventListener('change',e=>loadFont(e.target.files[0]));
$('text-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw {key:'textLarge'};const text=await file.text();if(text.length>10000)throw {key:'textLarge'};operationError=null;editor.setParagraphs(text.replace(/\r\n?/g,'\n').split('\n').map(text=>({text,align:'left'})));update();}catch(err){operationError={scope:'editor',key:err.key||'textUnreadable'};noticeDismissed='';renderNotices();}e.target.value='';});
$('editor').addEventListener('input',()=>{if(operationError?.scope==='editor'){operationError=null;renderNotices();}});
for(const key of numeric)$(key).addEventListener('input',()=>{if(key==='pageWidth'||key==='pageHeight')$('format').value='custom';if(key==='strokeWidth')$('pen').value='custom';if($(key).type==='range')rangeFeedback();schedule();});
for(const key of ['natural',...variationKeys.map(k=>'var-'+k)])$(key).addEventListener('input',()=>{rangeFeedback();schedule();});
for(const key of ['lineAuto','gapAuto','wrap','mode'])$(key).addEventListener('change',update);
for(const input of document.querySelectorAll('input[name="font-mode"]'))input.addEventListener('change',update);
$('format').addEventListener('change',()=>{if($('format').value==='custom')return;const [w,h]=$('format').value.split(',');$('pageWidth').value=w;$('pageHeight').value=h;zoom=1;update();});
$('pen').addEventListener('change',()=>{if($('pen').value!=='custom')$('strokeWidth').value=$('pen').value;update();});$('guides').addEventListener('change',()=>{let area;try{area=drawingArea(params());}catch{}renderPreview(params(),area);});
$('reroll').addEventListener('click',()=>{seed=(seed+7919)>>>0;update();});
for(const [id,fn] of [['zoom-in',()=>zoom=Math.min(4,zoom+.25)],['zoom-out',()=>zoom=Math.max(.25,zoom-.25)],['zoom-fit',()=>zoom=1]])$(id).addEventListener('click',()=>{fn();resize();});
$('download').addEventListener('click',e=>{if(timer)update();if(!downloadURL)e.preventDefault();});window.addEventListener('pagehide',e=>{if(!e.persisted&&downloadURL)URL.revokeObjectURL(downloadURL);});
setLanguage(new URLSearchParams(window.location.search).get('lang')||'de');if(language!=='de')editor.setParagraphs(defaults(language));new ResizeObserver(()=>resize()).observe($('stage'));applyLanguage();chooseFont('EMSNeato');
