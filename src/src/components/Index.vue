<template>
  <h2 class="sidebar-title">Index</h2>
  <el-menu
    :default-active="selected?.id"
    @select="handle_select"
    class="sidebar-menu"
    unique-opened
  >
    <el-menu-item v-for="entry in entries" :key="entry.id" :index="entry.id">
      {{ entry.title }}
    </el-menu-item>
  </el-menu>
</template>

<script>
import { inject, ref, watch } from "vue";
import yaml from "js-yaml";

export default {
  name: "Index",
  props: {
    base_url: {
      type: String,
      required: true,
    },
    content_path: {
      type: String,
      required: true,
    },
    page: {
      type: String,
      default: "index.yaml",
    },
  },
  setup(props) {
    // Inject the selected item from the parent
    const selected = inject("selected");

    const entries = ref([]);

    // Fetch and parse YAML
    const load_entries = async () => {
      try {
        const res = await fetch(
          `${props.base_url}/${props.content_path}/${props.page}`,
        );
        const yaml_text = await res.text();
        const parsed_yaml = yaml.load(yaml_text);

        if (parsed_yaml.entries) {
          entries.value = parsed_yaml.entries.map((entry, idx) => {
            if (!entry.id || entry.id === "dynamic") {
              entry.id = `id#${idx + 1}`;
            }

            console.log(entry);
            return entry;
          });
        }
      } catch (err) {
        console.error("Error loading YAML:", err);
      }
    };

    const handle_select = (selection) => {
      // Find and update the selected entry
      const selected_entry = entries.value.find(
        (entry) => entry.id === selection,
      );
      selected.value = selected_entry; // Update the global selected item
    };

    // Load the entries when the component mounts
    load_entries();

    watch(selected, (new_val) => {
      console.log("Selected item changed:", new_val);
    });

    return {
      entries,
      selected,
      handle_select,
    };
  },
};
</script>

<style scoped>
.sidebar-title {
  color: var(--el-color-primary);
  padding: 10px;
  font-size: 1.2em;
  font-weight: bold;
}

.sidebar-menu {
  background-color: var(--el-color-gray-light);
  color: var(--el-color-text-primary);
}

.el-menu-item {
  padding: 10px 20px;
  color: var(--el-color-text-primary);
}

.el-menu-item:hover {
  background-color: var(--el-color-primary-light);
}

.el-menu-item.is-active {
  background-color: var(--el-color-primary);
  color: var(--el-color-white);
}
</style>
