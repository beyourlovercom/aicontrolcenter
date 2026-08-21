<script lang="ts">
  export let onAutoCreateWorkPackage:()=>void=()=>{};
  export let onManualCreateWorkPackage:()=>void=()=>{};
  export let onRefresh:()=>void=()=>{};
</script>
<div class="global-task-action-bar" data-testid="global-wp-action-bar"><button class="service-action auto-create" data-testid="auto-create-wp" onclick={onAutoCreateWorkPackage}>✦ AI 建议 WP</button><button class="service-action" data-testid="manual-create-wp" onclick={onManualCreateWorkPackage}>＋ 手动创建WP</button><button class="service-action" data-testid="refresh-global-wp" onclick={onRefresh}>⟳ 刷新</button></div>
<style>.global-task-action-bar{display:flex;justify-content:flex-end;gap:6px;align-items:center}.global-task-action-bar button{height:30px;white-space:nowrap}.auto-create{border-color:var(--accent);color:var(--accent)}</style>
