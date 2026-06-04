import type { Schema, Struct } from '@strapi/strapi'

export interface BlocksAmbassador extends Struct.ComponentSchema {
  collectionName: 'components_blocks_ambassadors'
  info: {
    description: 'Display a single ambassador from the collection'
    displayName: 'Ambassador'
    icon: 'user'
  }
  attributes: {
    ambassador: Schema.Attribute.Relation<
      'oneToOne',
      'api::ambassador.ambassador'
    >
  }
}

export interface BlocksAmbassadorsGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_ambassadors_grids'
  info: {
    description: 'Displays selected ambassadors in a grid layout'
    displayName: 'Ambassadors Grid'
    icon: 'user'
  }
  attributes: {
    ambassadors: Schema.Attribute.Relation<
      'oneToMany',
      'api::ambassador.ambassador'
    >
    category: Schema.Attribute.Enumeration<['Fellows 2026']>
    heading: Schema.Attribute.String
  }
}

export interface BlocksBlockquote extends Struct.ComponentSchema {
  collectionName: 'components_blocks_blockquotes'
  info: {
    description: 'A styled blockquote with optional attribution'
    displayName: 'Blockquote'
    icon: 'quote'
  }
  attributes: {
    quote: Schema.Attribute.Text & Schema.Attribute.Required
    source: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultMarkdown'
        }
      >
  }
}

export interface BlocksCalloutText extends Struct.ComponentSchema {
  collectionName: 'components_blocks_callout_texts'
  info: {
    description: 'Highlighted text block with larger font size for emphasis'
    displayName: 'Callout Text'
    icon: 'megaphone'
  }
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.Required &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultMarkdown'
        }
      >
  }
}

export interface BlocksCard extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cards'
  info: {
    description: 'Single card with title, description, and optional link'
    displayName: 'Card'
    icon: 'dashboard'
  }
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    icon: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    link: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    linkText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    openInNewTab: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCardLink extends Struct.ComponentSchema {
  collectionName: 'components_blocks_card_links'
  info: {
    description: 'Simple link card with title and arrow'
    displayName: 'Card Link'
    icon: 'link'
  }
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    href: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    openInNewTab: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCardLinksGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_card_links_grids'
  info: {
    description: 'Grid of clickable card links'
    displayName: 'Card Links Grid'
    icon: 'th-large'
  }
  attributes: {
    cards: Schema.Attribute.Component<'blocks.card-link', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'3'>
    heading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    subheading: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCardsGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cards_grids'
  info: {
    description: 'Grid of cards with title and description'
    displayName: 'Cards Grid'
    icon: 'apps'
  }
  attributes: {
    cards: Schema.Attribute.Component<'blocks.card', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'3'>
    heading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    subheading: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCarousel extends Struct.ComponentSchema {
  collectionName: 'components_blocks_carousels'
  info: {
    description: 'Carousel/slider for testimonials or featured content'
    displayName: 'Carousel'
    icon: 'images'
  }
  attributes: {
    autoplay: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<true>
    heading: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    interval: Schema.Attribute.Integer &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<5000>
    items: Schema.Attribute.Component<'blocks.carousel-item', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCarouselItem extends Struct.ComponentSchema {
  collectionName: 'components_blocks_carousel_items'
  info: {
    description: 'Single carousel slide with quote and attribution'
    displayName: 'Carousel Item'
    icon: 'quote-right'
  }
  attributes: {
    author: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    image: Schema.Attribute.Media<'images'> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    organization: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    quote: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    role: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCodeBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_code_blocks'
  info: {
    description: 'Syntax-highlighted code snippet with optional title and copy button'
    displayName: 'Code Block'
    icon: 'code'
  }
  attributes: {
    code: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    language: Schema.Attribute.Enumeration<
      [
        'javascript',
        'typescript',
        'jsx',
        'tsx',
        'html',
        'css',
        'bash',
        'json',
        'yaml',
        'python',
        'rust',
        'go',
        'sql',
        'markdown'
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'javascript'>
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCtaBanner extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cta_banners'
  info: {
    description: 'Call-to-action banner with heading, text and buttons'
    displayName: 'CTA Banner'
    icon: 'bullhorn'
  }
  attributes: {
    backgroundColor: Schema.Attribute.Enumeration<
      ['primary', 'secondary', 'light', 'dark']
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'primary'>
    heading: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    primaryButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    primaryButtonText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    secondaryButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    secondaryButtonText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    text: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksCtaStrip extends Struct.ComponentSchema {
  collectionName: 'components_blocks_cta_strips'
  info: {
    description: 'Call-to-action strip with heading, description, a primary CTA, an optional secondary CTA, and a background colour'
    displayName: 'CTA Strip'
    icon: 'cursor'
  }
  attributes: {
    color: Schema.Attribute.Enumeration<['purple', 'green']> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'purple'>
    description: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heading: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    primaryButtonLink: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    primaryButtonText: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    secondaryButtonLink: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    secondaryButtonText: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksImageBlock extends Struct.ComponentSchema {
  collectionName: 'components_blocks_image_blocks'
  info: {
    description: 'Standalone image with optional responsive variants, outline, and full-view support'
    displayName: 'Image Block'
    icon: 'picture'
  }
  attributes: {
    altText: Schema.Attribute.String
    image: Schema.Attribute.Media<'images'> & Schema.Attribute.Required
    mobileImage: Schema.Attribute.Media<'images'>
    needsFullView: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>
    needsOutline: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>
    tabletImage: Schema.Attribute.Media<'images'>
  }
}

export interface BlocksImageRow extends Struct.ComponentSchema {
  collectionName: 'components_blocks_image_rows'
  info: {
    description: 'Image with text content, image can be positioned left or right'
    displayName: 'Image Row'
    icon: 'picture'
  }
  attributes: {
    attribution: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    content: Schema.Attribute.RichText &
      Schema.Attribute.Required &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultMarkdown'
        }
      > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    heading: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    image: Schema.Attribute.Media<'images'> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    imagePosition: Schema.Attribute.Enumeration<['left', 'right']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'right'>
  }
}

export interface BlocksParagraph extends Struct.ComponentSchema {
  collectionName: 'components_blocks_paragraphs'
  info: {
    description: 'Rich text content block'
    displayName: 'Paragraph'
    icon: 'align-left'
  }
  attributes: {
    alignment: Schema.Attribute.Enumeration<['left', 'center', 'right']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'left'>
    content: Schema.Attribute.RichText &
      Schema.Attribute.Required &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultMarkdown'
        }
      > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface BlocksPdfEmbed extends Struct.ComponentSchema {
  collectionName: 'components_blocks_pdf_embeds'
  info: {
    description: 'Inline PDF viewer with download fallback'
    displayName: 'PDF Embed'
    icon: 'file-pdf'
  }
  attributes: {
    externalUrl: Schema.Attribute.String
    file: Schema.Attribute.Media<'files'>
    label: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Download file'>
    source: Schema.Attribute.Enumeration<['media_library', 'external_url']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'media_library'>
  }
}

export interface BlocksVideoEmbed extends Struct.ComponentSchema {
  collectionName: 'components_blocks_video_embeds'
  info: {
    description: 'Embedded YouTube or Vimeo video'
    displayName: 'Video Embed'
    icon: 'play'
  }
  attributes: {
    title: Schema.Attribute.String & Schema.Attribute.Required
    url: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface NavigationMenuGroup extends Struct.ComponentSchema {
  collectionName: 'components_navigation_menu_groups'
  info: {
    description: 'A dropdown menu group with child items'
    displayName: 'Menu Group'
    icon: 'layer'
  }
  attributes: {
    href: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    items: Schema.Attribute.Component<'navigation.menu-item', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    subGroups: Schema.Attribute.Component<'navigation.menu-sub-group', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface NavigationMenuItem extends Struct.ComponentSchema {
  collectionName: 'components_navigation_menu_items'
  info: {
    description: 'A navigation menu item'
    displayName: 'Menu Item'
    icon: 'link'
  }
  attributes: {
    href: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    openInNewTab: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<false>
  }
}

export interface NavigationMenuSubGroup extends Struct.ComponentSchema {
  collectionName: 'components_navigation_menu_sub_groups'
  info: {
    description: "A labelled section nested inside a menu group, used to render the footer's tiered link columns"
    displayName: 'Menu Sub-Group'
    icon: 'bulletList'
  }
  attributes: {
    items: Schema.Attribute.Component<'navigation.menu-item', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedArticleBio extends Struct.ComponentSchema {
  collectionName: 'components_shared_article_bios'
  info: {
    displayName: 'Article Bio'
  }
  attributes: {
    author: Schema.Attribute.String & Schema.Attribute.Required
    link: Schema.Attribute.String
    profileBio: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'basicMarkdownPreset'
        }
      >
    profileImage: Schema.Attribute.Media<'images'>
  }
}

export interface SharedCategory extends Struct.ComponentSchema {
  collectionName: 'components_shared_categories'
  info: {
    displayName: 'Category'
  }
  attributes: {
    categoryValue: Schema.Attribute.Enumeration<
      [
        'Announcements',
        'Community & Events',
        'Grants & Grantee Insights',
        'Interledger Technology',
        'Thought Leadership'
      ]
    >
  }
}

export interface SharedCtaLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_cta_links'
  info: {
    displayName: 'Call-to-action Link'
  }
  attributes: {
    external: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    link: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    style: Schema.Attribute.Enumeration<['primary', 'secondary']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<'primary'>
    text: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedHero extends Struct.ComponentSchema {
  collectionName: 'components_shared_heroes'
  info: {
    description: 'Hero section with title, description and background image'
    displayName: 'Hero'
    icon: 'star'
  }
  attributes: {
    backgroundImage: Schema.Attribute.Media<'images'> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    hero_call_to_action: Schema.Attribute.Component<'shared.cta-link', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_hero_sections'
  info: {
    displayName: 'hero section'
  }
  attributes: {
    hero_call_to_action: Schema.Attribute.Component<'shared.cta-link', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    hero_content: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    hero_title: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedRelatedArticle extends Struct.ComponentSchema {
  collectionName: 'components_shared_related_articles'
  info: {
    displayName: 'Related Article'
  }
  attributes: {
    slug: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SharedSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_sections'
  info: {
    displayName: 'Text Block'
  }
  attributes: {
    content: Schema.Attribute.Blocks &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    name: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
  }
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos'
  info: {
    description: 'SEO metadata for pages'
    displayName: 'SEO'
    icon: 'search'
  }
  attributes: {
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300
      }>
  }
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.ambassador': BlocksAmbassador
      'blocks.ambassadors-grid': BlocksAmbassadorsGrid
      'blocks.blockquote': BlocksBlockquote
      'blocks.callout-text': BlocksCalloutText
      'blocks.card': BlocksCard
      'blocks.card-link': BlocksCardLink
      'blocks.card-links-grid': BlocksCardLinksGrid
      'blocks.cards-grid': BlocksCardsGrid
      'blocks.carousel': BlocksCarousel
      'blocks.carousel-item': BlocksCarouselItem
      'blocks.code-block': BlocksCodeBlock
      'blocks.cta-banner': BlocksCtaBanner
      'blocks.cta-strip': BlocksCtaStrip
      'blocks.image-block': BlocksImageBlock
      'blocks.image-row': BlocksImageRow
      'blocks.paragraph': BlocksParagraph
      'blocks.pdf-embed': BlocksPdfEmbed
      'blocks.video-embed': BlocksVideoEmbed
      'navigation.menu-group': NavigationMenuGroup
      'navigation.menu-item': NavigationMenuItem
      'navigation.menu-sub-group': NavigationMenuSubGroup
      'shared.article-bio': SharedArticleBio
      'shared.category': SharedCategory
      'shared.cta-link': SharedCtaLink
      'shared.hero': SharedHero
      'shared.hero-section': SharedHeroSection
      'shared.related-article': SharedRelatedArticle
      'shared.section': SharedSection
      'shared.seo': SharedSeo
    }
  }
}
