<template>
  <el-scrollbar style="height: 100%; overflow: auto">
    <div v-if="is_loading">Loading...</div>
    <div v-if="err" class="error_message">{{ err }}</div>

    <!-- Floating Index Section -->
    <el-card v-if="index.length" class="floating_index_card" :class="{ collapsed: is_collapsed }">
      <el-icon @click="toggle_collapse" v-if="is_collapsed" class="arrow-icon-left">
        <arrow-left />
      </el-icon>
      <el-icon @click="toggle_collapse" v-else class="arrow-icon-right">
        <arrow-right />
      </el-icon>
      <h3 :class="{ 'transparent-text': is_collapsed }">Index</h3>
      <div class="floating_index_card_links">
        <div v-for="item in index" :key="item.id">
          <div
            :class="{
              'index-item': true,
            }"
            :style="{ paddingLeft: (item.level - 1) * 20 + 'px' }" 
            @click="scroll_to(item.id)"
          >
            <el-text :class="{ 'transparent-text': is_collapsed, 'active-anchor': item.is_active && !is_collapsed }" >{{ item.title }}</el-text>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Markdown Content with Scroll -->
    <el-card v-if="file_content" class="custom_card">
      <div
        class="markdown_content"
        v-html="rendered_markdown"
        ref="markdown_container"
      />
    </el-card>
  </el-scrollbar>
</template>

<script setup>
import { ref, toRef, computed, watchEffect, nextTick, onMounted, onBeforeUnmount } from "vue";
import { ElNotification } from "element-plus";
import { marked } from "marked";
import hljs from "highlight.js";
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'; // Import icons

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
const index = ref([]);

const is_collapsed = ref(false); // State for collapse/expand

const file_url = computed(() => {
  return `${base_url}/${content_path}/${page.value}`;
});

const markdown_container = ref(null);

// Intersection Observer to detect which section is currently visible
let observer;

// Import the CSS files as text using Vite's raw import
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw';  // Raw import of dark theme CSS
import githubLightCss from 'highlight.js/styles/github.css?raw';      // Raw import of light theme CSS

// Variables to keep track of the current theme and the injected style tag
let currentTheme = 'light';  // Default to light theme
let currentStyleTag = null;

// Function to switch between themes
const updateTheme = () => {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  currentTheme = isDarkMode ? 'dark' : 'light';
  
  // Remove the previous theme style if it exists
  if (currentStyleTag) {
    currentStyleTag.remove();
  }

  // Inject the appropriate theme CSS as a <style> tag
  if (currentTheme === 'dark') {
    currentStyleTag = injectCss(githubDarkCss);
  } else {
    currentStyleTag = injectCss(githubLightCss);
  }

  // Reinitialize highlight.js after the theme switch
  hljs.highlightAll();
};

// Helper function to inject CSS content as a <style> tag
const injectCss = (cssContent) => {
  const styleTag = document.createElement('style');
  document.head.appendChild(styleTag);
  styleTag.innerHTML = cssContent;
  return styleTag;
};
onMounted(() => {
    // Initialize the theme based on the system's current preference
    updateTheme();
  // Watch for changes in system dark mode preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);

  // Initialize IntersectionObserver
  observer = new IntersectionObserver(onIntersectionChange, {
    root: markdown_container.value,
    rootMargin: '0px',
    threshold: 0.5, // Trigger when 50% of the section is in view
  });

  watchEffect(() => {
    if (observer) observer.disconnect();

    if (markdown_container.value) {
      const headings = markdown_container.value.querySelectorAll("h1, h2, h3, h4, h5, h6");
      headings.forEach((heading) => observer.observe(heading));
    }
  });

  // Automatically collapse index if window size changes
  window.addEventListener('resize', handle_resize);
  handle_resize(); // Initial check
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
  }
  window.removeEventListener('resize', handle_resize);
});

let visible_entries = [];
const onIntersectionChange = (entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      visible_entries.push(entry);
    } else {
      visible_entries = visible_entries.filter(e => e.target.id !== entry.target.id)
    }
  });

  const sorted_visible_entries = visible_entries.sort((a, b) => {
    const aIdParts = a.target.id.split('.').map(Number);
    const bIdParts = b.target.id.split('.').map(Number);

    for (let i = 0; i < Math.max(aIdParts.length, bIdParts.length); i++) {
      const aPart = aIdParts[i] || 0;
      const bPart = bIdParts[i] || 0;

      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    return 0;
  });

  const active_entry = sorted_visible_entries[0] || null;

  if (!active_entry) return;

  const active_id = active_entry.target.id;
  index.value.forEach((item) => {
    item.is_active = active_id === item.id;
  });
};

watchEffect(async () => {
  if (page.value) {
    await load_file();
  }
});

const generate_index = (markdown) => {
  const lines = markdown.split("\n");
  const heading_levels = [0, 0, 0, 0, 0, 0];
  const local_index = [];

  lines.forEach((line) => {
    const match = line.match(/^(#{1,6})\s+(.*)/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();

      heading_levels[level - 1]++;
      for (let i = level; i < heading_levels.length; i++) {
        heading_levels[i] = 0;
      }

      const id = heading_levels.slice(0, level).join(".");

      local_index.push({ id, level, title, is_active: false });
    }
  });

  index.value = local_index;
  return local_index;
};

const scroll_to = (id) => {
  if (!markdown_container.value) return;

  const target = markdown_container.value.querySelector(`[id="${id}"]`);
  if (target) {
    const parentElement = markdown_container.value.closest(".el-scrollbar__wrap");
    if (parentElement) {
      parentElement.scrollTo({
        top: target.offsetTop - parentElement.offsetTop,
        behavior: "smooth",
      });
    }
  }
};

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

    if (typeof text !== 'string') {
      throw new Error("The content is not a valid string");
    }

    file_content.value = text;

    const local_index = generate_index(text);

    const renderer = new marked.Renderer();
    renderer.heading = function (elem) {
      const text = elem?.text;
      const heading = local_index.find(item => item.title === text);
      const level = heading ? heading.level : 1;
      const id = heading ? heading.id : "1";
      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    rendered_markdown.value = marked(text, { renderer });

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
    // Reset the previous highlight by removing the 'data-highlighted' attribute
    block.removeAttribute('data-highlighted');

    // Reinitialize the highlight
    hljs.highlightElement(block);

    const language_class = Array.from(block.classList).find((cls) =>
      cls.startsWith("language-")
    );
    const language = language_class
      ? language_class.replace("language-", "")
      : "Plain Text";

    const header_bar = document.createElement("div");
    header_bar.classList.add("code_header_bar");

    const language_label = document.createElement("span");
    language_label.classList.add("language_label");
    language_label.innerText = language;
    header_bar.appendChild(language_label);

    const copy_button = document.createElement("button");
    copy_button.innerText = "Copy Raw";
    copy_button.classList.add("copy_button");

    copy_button.addEventListener("click", () => {
      navigator.clipboard
        .writeText(block.innerText)
        .then(() => {
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

    const pre_element = block.parentElement;
    pre_element.style.position = "relative"; 
    if (!pre_element.querySelector(".code_header_bar")) {
      pre_element.insertBefore(header_bar, block);
    }
  });
};

// Function to toggle the collapse state of the index card
const toggle_collapse = () => {
  is_collapsed.value = !is_collapsed.value;
};

// Function to check if the index card is overlapping with the markdown card
const handle_resize = () => {
  const markdown_card = document.querySelector(".custom_card");
  const index_card = document.querySelector(".floating_index_card");

  if (markdown_card && index_card) {
    const markdown_card_right = markdown_card.getBoundingClientRect().right;
    const index_card_left = index_card.getBoundingClientRect().left;
    const diff = markdown_card_right - index_card_left;

    if (diff > 50) {
      is_collapsed.value = true;
    } else if (diff < -300) {
      is_collapsed.value = false;
    }
  }
};
</script>

<style scoped>
.custom_card {
  background-color: var(--el-bg-color-page);
  border-radius: 16px;
  max-width: 80%;
  width: fit-content;
  padding: 20px;
  margin: 20px auto;
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

.floating_index_card {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 300px;
  background-color: var(--el-bg-color-page);
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.3s ease;
}

.floating_index_card.collapsed {
  transform: translateX(90%); /* Collapsed to the left */
}

.floating_index_card_links {
  text-align: left;
}

.index-item {
  cursor: pointer;
}

.floating_index_card h3 {
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: bold;
  color: var(--el-color-primary);
  cursor: pointer;
  position: relative;
}

.arrow-icon-left, .arrow-icon-right {
  margin: 8px;
  position: absolute;
  top: 0;
}

.arrow-icon-left {
  left: 0;
}

.arrow-icon-right {
  right: 0;
}

.transparent-text {
  color: transparent;
}

/* Active link style */
:deep(.active-anchor) {
  color: var(--el-color-primary);
}
</style>
