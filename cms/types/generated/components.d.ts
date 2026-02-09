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
    showLinks: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>
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
    heading: Schema.Attribute.String
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
    description: Schema.Attribute.Text
    icon: Schema.Attribute.String
    link: Schema.Attribute.String
    linkText: Schema.Attribute.String
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    title: Schema.Attribute.String & Schema.Attribute.Required
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
    description: Schema.Attribute.Text
    href: Schema.Attribute.String & Schema.Attribute.Required
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    title: Schema.Attribute.String & Schema.Attribute.Required
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
    cards: Schema.Attribute.Component<'blocks.card-link', true>
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>
    heading: Schema.Attribute.String
    subheading: Schema.Attribute.Text
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
    cards: Schema.Attribute.Component<'blocks.card', true>
    columns: Schema.Attribute.Enumeration<['2', '3', '4']> &
      Schema.Attribute.DefaultTo<'3'>
    heading: Schema.Attribute.String
    subheading: Schema.Attribute.Text
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
    autoplay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>
    heading: Schema.Attribute.String
    interval: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<5000>
    items: Schema.Attribute.Component<'blocks.carousel-item', true>
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
    author: Schema.Attribute.String
    image: Schema.Attribute.Media<'images'>
    organization: Schema.Attribute.String
    quote: Schema.Attribute.Text & Schema.Attribute.Required
    role: Schema.Attribute.String
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
      Schema.Attribute.DefaultTo<'primary'>
    heading: Schema.Attribute.String & Schema.Attribute.Required
    primaryButtonLink: Schema.Attribute.String
    primaryButtonText: Schema.Attribute.String
    secondaryButtonLink: Schema.Attribute.String
    secondaryButtonText: Schema.Attribute.String
    text: Schema.Attribute.Text
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
    attribution: Schema.Attribute.String
    content: Schema.Attribute.RichText & Schema.Attribute.Required
    heading: Schema.Attribute.String & Schema.Attribute.Required
    image: Schema.Attribute.Media<'images'> & Schema.Attribute.Required
    imagePosition: Schema.Attribute.Enumeration<['left', 'right']> &
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
      Schema.Attribute.DefaultTo<'left'>
    content: Schema.Attribute.RichText & Schema.Attribute.Required
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
    href: Schema.Attribute.String
    items: Schema.Attribute.Component<'navigation.menu-item', true>
    label: Schema.Attribute.String & Schema.Attribute.Required
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
    href: Schema.Attribute.String
    label: Schema.Attribute.String & Schema.Attribute.Required
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
  }
}

export interface SharedCtaLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_cta_links'
  info: {
    displayName: 'Call-to-action Link'
  }
  attributes: {
    analytics_event_label: Schema.Attribute.String
    external: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>
    link: Schema.Attribute.String & Schema.Attribute.Required
    style: Schema.Attribute.Enumeration<['primary', 'secondary']> &
      Schema.Attribute.DefaultTo<'primary'>
    text: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SharedHero extends Struct.ComponentSchema {
  collectionName: 'components_shared_heroes'
  info: {
    description: 'Hero section with title, description and CTAs'
    displayName: 'Hero'
    icon: 'star'
  }
  attributes: {
    backgroundImage: Schema.Attribute.Media<'images'>
    description: Schema.Attribute.Text
    secondaryCtas: Schema.Attribute.Component<'shared.cta-link', true>
    title: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface SharedHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_hero_sections'
  info: {
    displayName: 'hero section'
  }
  attributes: {
    hero_call_to_action: Schema.Attribute.Component<'shared.cta-link', true>
    hero_content: Schema.Attribute.Text
    hero_title: Schema.Attribute.Text
  }
}

export interface SharedSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_sections'
  info: {
    displayName: 'Text Block'
  }
  attributes: {
    content: Schema.Attribute.Blocks
    name: Schema.Attribute.String
    title: Schema.Attribute.String
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
    canonicalUrl: Schema.Attribute.String
    keywords: Schema.Attribute.Text
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160
      }>
    metaImage: Schema.Attribute.Media<'images'>
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60
      }>
  }
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'blocks.ambassador': BlocksAmbassador
      'blocks.ambassadors-grid': BlocksAmbassadorsGrid
      'blocks.card': BlocksCard
      'blocks.card-link': BlocksCardLink
      'blocks.card-links-grid': BlocksCardLinksGrid
      'blocks.cards-grid': BlocksCardsGrid
      'blocks.carousel': BlocksCarousel
      'blocks.carousel-item': BlocksCarouselItem
      'blocks.cta-banner': BlocksCtaBanner
      'blocks.image-row': BlocksImageRow
      'blocks.paragraph': BlocksParagraph
      'navigation.menu-group': NavigationMenuGroup
      'navigation.menu-item': NavigationMenuItem
      'shared.cta-link': SharedCtaLink
      'shared.hero': SharedHero
      'shared.hero-section': SharedHeroSection
      'shared.section': SharedSection
      'shared.seo': SharedSeo
    }
  }
}
