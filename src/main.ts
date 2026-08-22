import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import './prEvidence.css';
import './roadmapInteraction.css';
import './roadmapDom.css';
import './treeSelect.css';
import './statusTooltip.css';

const target=document.getElementById('app')!;
mount(App, { target });
requestAnimationFrame(()=>{(globalThis as typeof globalThis & {__AICC_MARK_FRONTEND_READY__?:()=>boolean}).__AICC_MARK_FRONTEND_READY__?.();});
