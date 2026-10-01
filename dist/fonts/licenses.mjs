import {setLanguage,language,t,translatePage} from '../i18n.mjs';
const select=document.getElementById('language');
function apply(){translatePage();select.value=language;document.title=t('licenseTitle')+' · Stiftspur';document.getElementById('back-link').href='../?lang='+language;}
setLanguage(new URLSearchParams(window.location.search).get('lang'));apply();
select.addEventListener('change',()=>{setLanguage(select.value);apply();});
