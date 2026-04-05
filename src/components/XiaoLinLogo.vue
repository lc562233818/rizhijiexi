<script setup lang="ts">
const props = defineProps<{
  size?: 'small' | 'medium' | 'large'
}>()

const sizeMap = {
  small: { container: '32px', font: '16px', icon: '20px' },
  medium: { container: '48px', font: '24px', icon: '28px' },
  large: { container: '64px', font: '32px', icon: '36px' }
}

const currentSize = sizeMap[props.size || 'medium']
</script>

<template>
  <div class="xiaolin-logo" :style="{ width: currentSize.container, height: currentSize.container }">
    <svg viewBox="0 0 100 100" class="logo-svg" :style="{ width: currentSize.icon, height: currentSize.icon }">
      <!-- 圆形背景 -->
      <circle cx="50" cy="50" r="45" fill="#409EFF" />
      <!-- 内部装饰圆环 -->
      <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.3" />
      <!-- 小林的 "林" 字简化为树形 -->
      <g fill="#ffffff">
        <!-- 树干 -->
        <rect x="46" y="30" width="8" height="40" rx="2" />
        <!-- 左边树枝 -->
        <rect x="28" y="42" width="20" height="6" rx="2" transform="rotate(-30 38 45)" />
        <rect x="25" y="32" width="15" height="5" rx="2" transform="rotate(-45 32 34)" />
        <!-- 右边树枝 -->
        <rect x="52" y="42" width="20" height="6" rx="2" transform="rotate(30 62 45)" />
        <rect x="60" y="32" width="15" height="5" rx="2" transform="rotate(45 67 34)" />
        <!-- 树叶圆点 -->
        <circle cx="25" cy="28" r="5" />
        <circle cx="40" cy="22" r="4" />
        <circle cx="60" cy="22" r="4" />
        <circle cx="75" cy="28" r="5" />
      </g>
    </svg>
    <span class="logo-text" :style="{ fontSize: currentSize.font }">小Lin</span>
  </div>
</template>

<style scoped>
.xiaolin-logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.logo-svg {
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.xiaolin-logo:hover .logo-svg {
  transform: rotate(10deg);
}

.logo-text {
  font-weight: 700;
  color: #409EFF;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  letter-spacing: -1px;
  white-space: nowrap;
}
</style>
