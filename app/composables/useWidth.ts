// The width of an element, kept up to date (for the SVG charts)
export function useWidth(el: Ref<HTMLElement | undefined>, fallback = 600) {
  const width = ref(fallback)
  let ro: ResizeObserver | undefined
  onMounted(() => {
    if (!el.value) return
    width.value = el.value.clientWidth || fallback
    ro = new ResizeObserver(([e]) => { if (e) width.value = Math.max(240, Math.floor(e.contentRect.width)) })
    ro.observe(el.value)
  })
  onBeforeUnmount(() => ro?.disconnect())
  return width
}
