Nova.booting((Vue, router, store) => {
  Vue.component(
    'index-map-multi-linestring-nova3',
    require('./components/IndexField').default
  )
  Vue.component(
    'detail-map-multi-linestring-nova3',
    require('./components/DetailField').default
  )
  Vue.component(
    'form-map-multi-linestring-nova3',
    require('./components/FormField').default
  )
  Vue.component(
    'wm-map-multi-linestring',
    require('./components/mapComponent').default
  )
})
