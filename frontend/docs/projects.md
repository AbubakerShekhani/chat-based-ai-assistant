---
layout: home
title: "Projects by Stevanus Satria - Software & Hardware Portfolio"
description: "Explore Stevanus Satria's diverse portfolio of projects including Advocado AI assistant, VitePress portfolio, Figma plugins, robotics projects, and innovative hardware solutions."
keywords: "Stevanus Satria projects, Advocado AI, VitePress portfolio, Figma plugins, robotics, hardware projects, software development, Singapore"
author: "Stevanus Satria"
head:
  - - meta
    - property: og:title
      content: "Projects by Stevanus Satria - Software & Hardware Portfolio"
  - - meta
    - property: og:description
      content: "Explore Stevanus Satria's diverse portfolio of projects including Advocado AI assistant, VitePress portfolio, Figma plugins, robotics projects, and innovative hardware solutions."
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:url
      content: https://stevanussatria.com/projects
  - - link
    - rel: canonical
      href: https://stevanussatria.com/projects

features:
  - icon:
      src: /llm-judge.png
      alt: LLM Judge Documentation Evaluation Tool
    title: docs-eval (Private Repo)
    details: A simple LLM-as-a-judge implementation for documentation agent output, hosted on Vercel
    link: https://github.com/stevahnes/docs-eval
    target: _blank
  - icon:
      src: /advocado.webp
      alt: Advocado AI Assistant
    title: Advocado
    details: My biggest advocate, made possible by Langbase and Vercel
    link: https://github.com/stevahnes/vitepress-portfolio/tree/main/advocado
    target: _blank
  - icon:
      src: /vitepress.webp
      alt: VitePress Portfolio Website
    title: Portfolio (VitePress)
    details: Revamped personal website built using VitePress
    link: https://github.com/stevahnes/vitepress-portfolio
    target: _blank
  - icon:
      src: /call-home.png
      alt: Call Home Application
    title: Call Home
    details: Implemented call quality feedback feature and initial v2
    link: https://github.com/bettersg/call-home
    target: _blank
  - icon:
      src: /wordpress.svg
      alt: WordPress Portfolio Website
    title: Portfolio (WordPress)
    details: Legacy personal website built on WordPress
    link: /projects/portfolio-wordpress
  - icon:
      src: /figma.webp
      alt: Figma Plugins Collection
    title: Figma Plugins
    details: Various plugins written in HTML, CSS, and TypeScript
    link: https://www.figma.com/@stevahnes
    target: _blank
  - icon:
      src: /brume.png
      alt: BRÜ-ME Coffee Brewer
    title: BRÜ-ME
    details: Made a cheap manual brewer semi-automatic
    link: https://youtu.be/ch4kpChdSHs
    target: _blank
  - icon:
      src: /longboard.png
      alt: Lumos Longboard with Headlight
    title: Lumos
    details: 3D-printed custom nose guard with headlight
    link: https://youtu.be/qXR_C5dezqM
    target: _blank
  - icon:
      src: /lego.png
      alt: RoverBot Arduino Robot
    title: RoverBot
    details: Arduino-based robot kit designed for workshop
    link: https://youtu.be/VbQ1-GKdCEk
    target: _blank
  - icon:
      src: /zouba.png
      alt: ZOUBA Foldable Electric Scooter
    title: ZOUBA
    details: Foldable electric scooter that fits into your backpack
    link: https://youtu.be/oQVsBJ_NuM8
    target: _blank
  - icon:
      src: /modbot.png
      alt: Mod-Bot Reconfigurable Cleaning Robot
    title: Mod-Bot
    details: Reconfigurable cleaning robot for maximum area coverage
    link: https://youtu.be/DdzkIislYo0
    target: _blank
  - icon:
      src: /salamander.webp
      alt: SALAMANDER Amphibious Robot
    title: SALAMANDER
    details: Portable amphibious spherical rolling robot designed for reconnaissance
    link: https://youtu.be/3CECXdaeLnI
    target: _blank
  - icon:
      src: /velox.png
      alt: Velox Custom Electric Skateboard
    title: Velox
    details: Custom electric skateboard with 3D-printed motor mount
    link: https://youtu.be/IPcm3R25azw
    target: _blank
  - icon:
      src: /troll-kart.png
      alt: Troll Kart DIY Electric Go-Kart
    title: Troll Kart
    details: DIY electric go-kart built during my exchange at MIT
    link: https://youtu.be/lIg7apmuWjo
    target: _blank
  - icon:
      src: /quadwalker.png
      alt: Quadwalker Motorized Walking Stick
    title: Quadwalker
    details: Motorized walking stick designed for ground contact at all times
    link: https://youtu.be/xLcHc-iailM
    target: _blank
---

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const MiniChat = defineAsyncComponent(() => 
  import('./components/MiniChat.vue')
)
</script>

<MiniChat />
