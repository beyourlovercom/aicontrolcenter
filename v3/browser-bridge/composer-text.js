(()=>{
  'use strict';
  const BLOCK_TAGS=new Set(['P','DIV','LI','PRE','BLOCKQUOTE']);
  function tagName(node){return typeof node?.tagName==='string'?node.tagName.toUpperCase():'';}
  function className(node){return typeof node?.getAttribute==='function'?(node.getAttribute('class')||''):'';}
  function childNodes(node){return node?.childNodes?Array.from(node.childNodes):[];}
  function inlineText(node){
    if(!node)return '';
    if(node.nodeType===3)return typeof node.nodeValue==='string'?node.nodeValue:'';
    if(node.nodeType!==1)return '';
    const tag=tagName(node);
    if(tag==='BR')return /(?:^|\s)ProseMirror-trailingBreak(?:\s|$)/.test(className(node))?'':'\n';
    const children=childNodes(node);
    if(!children.length)return typeof node.textContent==='string'?node.textContent:'';
    return children.map(inlineText).join('');
  }
  function blockText(node){
    const children=childNodes(node);
    if(children.length===1&&tagName(children[0])==='BR')return '';
    return children.length?children.map(inlineText).join(''):(typeof node?.textContent==='string'?node.textContent:'');
  }
  function composerPlainText(node){
    if(!node)return null;
    const tag=tagName(node);
    if((tag==='TEXTAREA'||tag==='INPUT')&&typeof node.value==='string')return node.value;
    const children=childNodes(node);
    if(!children.length)return typeof node.textContent==='string'?node.textContent:'';
    const parts=[];let inline='';
    const flushInline=()=>{if(inline!==''){parts.push(inline);inline='';}};
    for(const child of children){
      if(child?.nodeType===1&&BLOCK_TAGS.has(tagName(child))){flushInline();parts.push(blockText(child));}
      else inline+=inlineText(child);
    }
    flushInline();
    return parts.length?parts.join('\n'):inline;
  }
  globalThis.__AICC_COMPOSER_PLAIN_TEXT__=composerPlainText;
})();
