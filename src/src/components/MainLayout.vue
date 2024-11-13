<template>
  <div class="common_layout">
    <el-container style="height: 100vh">
      <!-- Sidebar: Index component with scroll -->
      <el-aside width="200px" class="sidebar">
        <el-scrollbar style="height: 100%; overflow: auto">
          <Index
            :base_url="base_url"
            :content_path="content_path"
            :page="index_page"
          />
        </el-scrollbar>
      </el-aside>

      <!-- Main Content Area with scroll -->
      <el-container style="height: 100vh">
        <!--
        <el-header class="header">
          <h2>Header</h2>
        </el-header>
-->
        <!-- Main Section: Page Component with scroll -->
        <el-main class="main_content">
          <el-scrollbar style="height: 100%; overflow: auto">
            <Page
              :base_url="base_url"
              :content_path="content_path"
              :page="page"
            />
          </el-scrollbar>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import { ref, inject, watch } from "vue";
import Index from "./Index.vue";
import Page from "./Page.vue";

export default {
  name: "MainLayout",
  components: {
    Index,
    Page,
  },
  props: {
    base_url: {
      type: String,
      required: true,
    },
    content_path: {
      type: String,
      required: true,
    },
    index_page: {
      type: String,
      default: "index.yaml",
    },
    current_page: {
      type: String,
      default: "index.yaml",
    },
  },
  setup() {
    // Inject the selected item from the parent
    const selected_item = inject("selected");
    const page = ref(undefined);

    watch(selected_item, (new_val) => {
      console.log("Selected index item changed:", new_val);
      page.value = new_val?.page;
    });

    return { page };
  },
};
</script>

<style>
:root .el-main {
  --el-main-padding: 0px;
}
</style>

<style scoped>
.common_layout {
  display: flex;
  height: 100%;
  width: 100%;
  flex-direction: row;
}

.sidebar {
  background-color: var(--el-color-gray-light);
  height: 100%;
}

.header {
  background-color: var(--el-color-primary);
  color: var(--el-color-white);
  padding: 10px;
  text-align: center;
}

.main_content {
  padding: 0px;
  overflow: hidden;
  height: 100%;
}
</style>
