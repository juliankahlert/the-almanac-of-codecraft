<template>
  <el-scrollbar style="height: 100%; overflow: auto">
    <div v-if="is_loading">Loading...</div>
    <div v-if="err" class="error_message">{{ err }}</div>

    <!-- Floating Index Section -->
    <el-card v-if="index.length" class="floating_index_card">
      <h3>Index</h3>
      <div class="floating_index_card_links">
        <div v-for="item in index" :key="item.id">
          <div
            :class="{
              'index-item': true,
            }"
            :style="{ paddingLeft: (item.level - 1) * 20 + 'px' }"
            @click="scroll_to(item.id)"
          >
            <el-text :class="{ 'active-anchor': item.is_active }" >{{ item.title }}</el-text>
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
const index = ref([]);

const file_url = computed(() => {
  return `${base_url}/${content_path}/${page.value}`;
});

const markdown_container = ref(null);

// Intersection Observer to detect which section is currently visible
let observer;

onMounted(() => {
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
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
  }
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

  console.log("visible:", visible_entries);
  // Sort the visible_entries by the id attribute, in ascending order
  const sorted_visible_entries = visible_entries.sort((a, b) => {
    // Convert the ID to a numeric array (e.g., '1.1' -> [1, 1])
    const aIdParts = a.target.id.split('.').map(Number);
    const bIdParts = b.target.id.split('.').map(Number);

    // Compare each part of the IDs (assuming numerical structure)
    for (let i = 0; i < Math.max(aIdParts.length, bIdParts.length); i++) {
      const aPart = aIdParts[i] || 0; // Default to 0 if the part is missing
      const bPart = bIdParts[i] || 0; // Default to 0 if the part is missing

      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    return 0; // If they are equal
  });

  // The first entry in the sorted array is the one with the smallest ID
  const active_entry = sorted_visible_entries[0] || null;

  if (!active_entry)
    return;

  const active_id = active_entry.target.id;
  index.value.forEach((item) => {
    item.is_active = active_id === item.id;
  });

  console.log("Active ID:", active_id);
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

      // Increment the current level and reset sublevels
      heading_levels[level - 1]++;
      for (let i = level; i < heading_levels.length; i++) {
        heading_levels[i] = 0;
      }

      // Construct the ID based on the levels
      const id = heading_levels.slice(0, level).join(".");

      // Add ID to headings in the markdown content
      local_index.push({ id, level, title, is_active: false });
    }
  });

  index.value = local_index;
  return local_index;
};


const scroll_to = (id) => {
  if (!markdown_container.value) return;

  // Find the corresponding heading by its ID in the rendered content
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

    // Check if the content is a valid string before passing to marked
    if (typeof text !== 'string') {
      throw new Error("The content is not a valid string");
    }

    file_content.value = text;

    const local_index = generate_index(text);

    // Ensure the markdown renderer works with the correct input
    const renderer = new marked.Renderer();
    renderer.heading = function (elem) {
      const text = elem?.text;
      const heading = local_index.find(item => item.title === text);
      const level = heading ? heading.level : 1; // Default to level 1 if not found
      const id = heading ? heading.id : "1";
      console.log(elem);
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
}

/* Active link style */
:deep(.active-anchor) {
  color: var(--el-color-primary);
}
</style>
