<template>
  <div v-if="is_loading">Loading...</div>
  <div v-if="err" class="error_message">{{ err }}</div>
  <el-card v-if="file_content" class="custom_card">
    <div class="markdown_content" v-html="rendered_markdown" />
  </el-card>
</template>

<script setup>
import { ref, toRef, computed, watchEffect, nextTick } from "vue";
import { ElMessage } from "element-plus";
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
    enhance_code_blocks();
  } catch (e) {
    err.value = `Error: ${e.message}`;
  } finally {
    is_loading.value = false;
  }
};

const enhance_code_blocks = () => {
  const code_blocks = document.querySelectorAll(".markdown_content pre code");

  code_blocks.forEach((block) => {
    // Highlight the code
    hljs.highlightElement(block);

    // Extract language from class (e.g., "language-javascript")
    const language_class = Array.from(block.classList).find((cls) =>
      cls.startsWith("language-")
    );
    const language = language_class
      ? language_class.replace("language-", "")
      : "Plain Text";

    // Create a header bar
    const header_bar = document.createElement("div");
    header_bar.classList.add("code_header_bar");

    // Add language label
    const language_label = document.createElement("span");
    language_label.classList.add("language_label");
    language_label.innerText = language;
    header_bar.appendChild(language_label);

    // Add "Copy Raw" button
    const copy_button = document.createElement("button");
    copy_button.innerText = "Copy Raw";
    copy_button.classList.add("copy_button");

    // Add click event to copy the raw code
    copy_button.addEventListener("click", () => {
      navigator.clipboard
        .writeText(block.innerText)
        .then(() => {
          // Show success notification
          ElNotification({
            title: "Copied!",
            message: "Code copied to clipboard successfully.",
            type: "success",
            position: "bottom-right",
            duration: 3000,
          });
        })
        .catch(() => {
          ElNotification({
            title: "Error",
            message: "Failed to copy code!",
            type: "error",
            position: "bottom-right",
            duration: 3000,
          });
        });
    });

    header_bar.appendChild(copy_button);

    // Insert the header bar before the code block
    const pre_element = block.parentElement;
    pre_element.style.position = "relative"; // To position the bar correctly
    if (!pre_element.querySelector(".code_header_bar")) {
      pre_element.insertBefore(header_bar, block);
    }
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

/* Code block styling */
.markdown_content pre {
  background-color: var(--el-color-info-dark-2);
  color: var(--el-color-white);
  margin: 0;
  padding: 0;
  border-radius: 4px;
  overflow: hidden;
}

.markdown_content code {
  color: var(--el-color-primary-light-5);
  display: block;
  padding: 10px;
}

:deep(.markdown_content pre code) {
  border-radius: 0 0 8px 8px;
}

:deep(.code_header_bar) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--el-color-primary);
  color: var(--el-color-white);
  padding: 8px 12px;
  font-size: 14px;
  font-weight: bold;
  width: 100%;
  box-sizing: border-box;
  border-radius: 8px 8px 0 0;
}

:deep(.language_label) {
  font-size: 12px;
}

:deep(.copy_button) {
  background-color: var(--el-color-white);
  color: var(--el-color-primary);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}

:deep(.copy_button:hover) {
  background-color: var(--el-color-info-light-3);
}
</style>
