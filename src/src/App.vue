<template>
  <MainLayout
    :base_url="'https://raw.githubusercontent.com/juliankahlert/the-almanac-of-codecraft'"
    :content_path="'refs/heads/main/content'"
    :index_page="'index.yaml'"
    :current_page="'simple-github-pages-setup.md'"
  />
</template>

<script>
import { ref, provide } from "vue";
import MainLayout from "./components/MainLayout.vue";

export default {
  components: {
    MainLayout,
  },
  setup() {
    // Create a reactive selected item
    const selected_item = ref(undefined);

    // Provide the selected item globally
    provide("selected", selected_item);

    return {
      selected_item,
    };
  },
};
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  height: 100vh;
  width: 100vw;
  min-width: 100vw;
  max-width: 100vw;
  overflow: hidden;
}
</style>
