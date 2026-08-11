import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import './prEvidence.css';
import './roadmapInteraction.css';
import './roadmapDom.css';
import './treeSelect.css';
import './statusTooltip.css';

mount(App, { target: document.getElementById('app')! });
