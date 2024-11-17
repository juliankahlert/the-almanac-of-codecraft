<template>
  <div v-if="is_loading">Loading...</div>
  <div v-if="err" class="error_message">{{ err }}</div>
  <el-card v-if="file_content" class="custom_card">
    <div class="markdown_content" v-html="rendered_markdown" />
  </el-card>
</template>

<script setup>
import { ref, toRef, computed, watchEffect, nextTick } from "vue";
import { ElButton, ElCard } from "element-plus";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

const props = defineProps({
  base_url: {
    type: String,
    required: false,
  },
  content_path: {
    type: String,
    required: false,
  },
  page: {
    type: String,
    required: false,
  },
});

const base_url =
  props["base_url"] ||
  "https://raw.githubusercontent.com/juliankahlert/the-almanac-of-codecraft";
const content_path = props["content_path"] || "refs/heads/main/content";
const page = toRef(props, "page");

const file_content = ref("");
const rendered_markdown = ref("");
const is_loading = ref(false);
const err = ref("");

const file_url = computed(() => {
  return `${base_url}/${content_path}/${page.value}`;
});

watchEffect(async () => {
  if (page.value) {
    await load_file();
  }
});

const load_file = async () => {
  is_loading.value = true;
  err.value = "";
  file_content.value = "";
  rendered_markdown.value = "";

  try {
    const res = await fetch(file_url.value);

    if (!res.ok) {
      throw new Error("Failed to fetch the file");
    }

    const text = await res.text();
    file_content.value = text;
    rendered_markdown.value = marked(text);

    await nextTick();
    highlight_code_blocks();
  } catch (e) {
    err.value = `Error: ${e.message}`;
  } finally {
    is_loading.value = false;
  }
};

const highlight_code_blocks = () => {
  const code_blocks = document.querySelectorAll(".markdown_content pre code");
  code_blocks.forEach((block) => {
    hljs.highlightElement(block);
  });
};
</script>

<style scoped>
.custom_card {
  background-color: var(--el-bg-color-page);
  border-radius: 16px;
  max-width: 80%;
  width: fit-content;
  padding: 20px;
  margin: 20px auto; /* Center horizontally */
}

.markdown_content {
  padding: 16px;
  background-color: var(--el-bg-color-page);
  font-family: "Arial", sans-serif;
  line-height: 1.6;
  border-radius: 4px;
  text-align: left;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.error_message {
  color: var(--el-color-error);
  font-weight: bold;
}

/* Optional: Style the code blocks */
.markdown_content pre {
  background-color: var(--el-color-info-dark-2);
  color: var(--el-color-white);
  padding: 10px;
  border-radius: 4px;
}

.markdown_content code {
  color: var(--el-color-primary-light-5);
}
</style>
