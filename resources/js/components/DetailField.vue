<template>
    <panel-item :field="field" >
        <template #value>
            <wm-map-multi-linestring :field="field" :edit=false></wm-map-multi-linestring>
        </template>
    </panel-item>
</template>
<script>
export default {
    props: ['field'],
}
</script>
