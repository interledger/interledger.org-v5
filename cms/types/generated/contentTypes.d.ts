import type { Schema, Struct } from '@strapi/strapi'

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens'
  info: {
    description: ''
    displayName: 'Api Token'
    name: 'Api Token'
    pluralName: 'api-tokens'
    singularName: 'api-token'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }> &
      Schema.Attribute.DefaultTo<''>
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    expiresAt: Schema.Attribute.DateTime
    lastUsedAt: Schema.Attribute.DateTime
    lifespan: Schema.Attribute.BigInteger
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >
    publishedAt: Schema.Attribute.DateTime
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions'
  info: {
    description: ''
    displayName: 'API Token Permission'
    name: 'API Token Permission'
    pluralName: 'api-token-permissions'
    singularName: 'api-token-permission'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions'
  info: {
    description: ''
    displayName: 'Permission'
    name: 'Permission'
    pluralName: 'permissions'
    singularName: 'permission'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>
    publishedAt: Schema.Attribute.DateTime
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles'
  info: {
    description: ''
    displayName: 'Role'
    name: 'Role'
    pluralName: 'roles'
    singularName: 'role'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    description: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>
  }
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions'
  info: {
    description: 'Session Manager storage'
    displayName: 'Session'
    name: 'Session'
    pluralName: 'sessions'
    singularName: 'session'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
    i18n: {
      localized: false
    }
  }
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private
    childId: Schema.Attribute.String & Schema.Attribute.Private
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique
    status: Schema.Attribute.String & Schema.Attribute.Private
    type: Schema.Attribute.String & Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private
  }
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens'
  info: {
    description: ''
    displayName: 'Transfer Token'
    name: 'Transfer Token'
    pluralName: 'transfer-tokens'
    singularName: 'transfer-token'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }> &
      Schema.Attribute.DefaultTo<''>
    expiresAt: Schema.Attribute.DateTime
    lastUsedAt: Schema.Attribute.DateTime
    lifespan: Schema.Attribute.BigInteger
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions'
  info: {
    description: ''
    displayName: 'Transfer Token Permission'
    name: 'Transfer Token Permission'
    pluralName: 'transfer-token-permissions'
    singularName: 'transfer-token-permission'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users'
  info: {
    description: ''
    displayName: 'User'
    name: 'User'
    pluralName: 'users'
    singularName: 'user'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6
      }>
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6
      }>
    preferedLanguage: Schema.Attribute.String
    publishedAt: Schema.Attribute.DateTime
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    username: Schema.Attribute.String
  }
}

export interface ApiFoundationBlogPostFoundationBlogPost
  extends Struct.CollectionTypeSchema {
  collectionName: 'foundation_blog_posts'
  info: {
    description: 'Blog posts (grants, policy, announcements, technology)'
    displayName: 'Blog post'
    pluralName: 'foundation-blog-posts'
    singularName: 'foundation-blog-post'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    articleBio: Schema.Attribute.Component<'shared.article-bio', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    categories: Schema.Attribute.Component<'shared.category', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    content: Schema.Attribute.DynamicZone<
      [
        'blocks.paragraph',
        'blocks.video-embed',
        'blocks.image-block',
        'blocks.code-block'
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    date: Schema.Attribute.Date &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    description: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featured: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    featureImage: Schema.Attribute.Media<'images'> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    featureImageMobile: Schema.Attribute.Media<'images'> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    lastUpdated: Schema.Attribute.Date &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    legacy: Schema.Attribute.Boolean &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.DefaultTo<false>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::foundation-blog-post.foundation-blog-post'
    >
    pathSlug: Schema.Attribute.UID<'title'> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    relatedArticles: Schema.Attribute.Component<
      'shared.related-article',
      true
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.SetMinMax<
        {
          max: 3
        },
        number
      >
    thumbnailImage: Schema.Attribute.Media<'images'> &
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
      }> &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiFoundationNavigationFoundationNavigation
  extends Struct.SingleTypeSchema {
  collectionName: 'foundation_navigations'
  info: {
    description: 'Foundation site navigation menu'
    displayName: 'Foundation Navigation'
    pluralName: 'foundation-navigations'
    singularName: 'foundation-navigation'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    ctaButton: Schema.Attribute.Component<'navigation.menu-item', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::foundation-navigation.foundation-navigation'
    >
    mainMenu: Schema.Attribute.Component<'navigation.menu-group', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiFoundationPageFoundationPage
  extends Struct.CollectionTypeSchema {
  collectionName: 'foundation-pages'
  info: {
    description: 'Website pages with dynamic content blocks. Full path slug sets the URL and file location.'
    displayName: 'Foundation Page'
    pluralName: 'foundation-pages'
    singularName: 'foundation-page'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    content: Schema.Attribute.DynamicZone<
      [
        'blocks.paragraph',
        'blocks.profile',
        'blocks.profile-grid',
        'blocks.blockquote',
        'blocks.callout-text',
        'blocks.cta-strip',
        'blocks.pdf-embed',
        'blocks.video-embed'
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    hero: Schema.Attribute.Component<'shared.hero', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::foundation-page.foundation-page'
    >
    pathSlug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    pillar: Schema.Attribute.Enumeration<
      ['vision', 'mission', 'tech', 'values']
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    seo: Schema.Attribute.Component<'shared.seo', false> &
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
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiGrantOverviewPageGrantOverviewPage
  extends Struct.CollectionTypeSchema {
  collectionName: 'grant-overview-pages'
  info: {
    description: 'Overview pages for grant categories. Path slug is relative to /grant/ \u2014 e.g. education \u2192 /grant/education. Slugs must not clash with Grant Page slugs.'
    displayName: 'Grant Overview Page'
    pluralName: 'grant-overview-pages'
    singularName: 'grant-overview-page'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    content: Schema.Attribute.DynamicZone<
      [
        'blocks.paragraph',
        'blocks.split-layout',
        'blocks.blockquote',
        'blocks.callout-text',
        'blocks.video-embed',
        'blocks.image-block',
        'blocks.cta-strip',
        'blocks.cta-banner',
        'blocks.carousel'
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    ctaStrip: Schema.Attribute.Component<'blocks.cta-strip', false> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    description: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    followUpContent: Schema.Attribute.RichText &
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
    hero: Schema.Attribute.Component<'shared.hero', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::grant-overview-page.grant-overview-page'
    >
    pathSlug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiGrantPageGrantPage extends Struct.CollectionTypeSchema {
  collectionName: 'grant-pages'
  info: {
    description: 'Individual grant program pages. Path slug is relative to /grant/ \u2014 e.g. education/on-campus \u2192 /grant/education/on-campus.'
    displayName: 'Grant Page'
    pluralName: 'grant-pages'
    singularName: 'grant-page'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    content: Schema.Attribute.DynamicZone<
      [
        'blocks.paragraph',
        'blocks.split-layout',
        'blocks.blockquote',
        'blocks.callout-text',
        'blocks.video-embed',
        'blocks.image-block',
        'blocks.cta-strip',
        'blocks.cta-banner',
        'blocks.carousel'
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    ctaStrip: Schema.Attribute.Component<'blocks.cta-strip', false> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    description: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    faqSection: Schema.Attribute.Component<'blocks.grant-faq-section', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    infoCards: Schema.Attribute.Component<'blocks.info-cards', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::grant-page.grant-page'
    >
    pathSlug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    primaryCta: Schema.Attribute.Component<'shared.primary-cta-link', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    programOverview: Schema.Attribute.RichText &
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
    publishedAt: Schema.Attribute.DateTime
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiProfilePageProfilePage extends Struct.CollectionTypeSchema {
  collectionName: 'profile_pages'
  info: {
    description: 'Person profiles (ambassadors, judges, leadership, etc.), grouped by the free-text `category` field. pathSlug sets the public URL; MDX is always stored flat under src/content/profile/ (or profile/es/).'
    displayName: 'Profile Page'
    pluralName: 'profile-pages'
    singularName: 'profile-page'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    category: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    content: Schema.Attribute.DynamicZone<['blocks.paragraph']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    cta: Schema.Attribute.Component<'shared.cta-link', false> &
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
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::profile-page.profile-page'
    >
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255
      }>
    pathSlug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    photo: Schema.Attribute.Media<'images'> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    role: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    section: Schema.Attribute.Enumeration<
      ['foundation', 'summit', 'hackathon']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    tagline: Schema.Attribute.String &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiReportReport extends Struct.CollectionTypeSchema {
  collectionName: 'reports'
  info: {
    description: 'Research and policy reports, grouped anywhere on the site via the `section` field. pathSlug sets the public URL; MDX is always stored flat under src/content/reports/ (or reports/es/).'
    displayName: 'Report'
    pluralName: 'reports'
    singularName: 'report'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    content: Schema.Attribute.DynamicZone<['blocks.paragraph']> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    date: Schema.Attribute.Component<'shared.report-date', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
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
    introParagraph: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'basicMarkdownPreset'
        }
      > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::report.report'>
    pathSlug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    section: Schema.Attribute.Enumeration<
      ['foundation', 'summit', 'hackathon']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: false
        }
      }>
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }> &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255
      }>
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiSummitNavigationSummitNavigation
  extends Struct.SingleTypeSchema {
  collectionName: 'summit_navigations'
  info: {
    description: 'Summit pages navigation menu'
    displayName: 'Summit Navigation'
    pluralName: 'summit-navigations'
    singularName: 'summit-navigation'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    ctaButton: Schema.Attribute.Component<'navigation.menu-item', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::summit-navigation.summit-navigation'
    >
    mainMenu: Schema.Attribute.Component<'navigation.menu-group', true> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface ApiSummitPageSummitPage extends Struct.CollectionTypeSchema {
  collectionName: 'summit_pages'
  info: {
    description: 'Summit pages with dark theme. Full path slug sets the URL and file location.'
    displayName: 'Summit Page'
    pluralName: 'summit-pages'
    singularName: 'summit-page'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    i18n: {
      localized: true
    }
  }
  attributes: {
    content: Schema.Attribute.DynamicZone<
      [
        'blocks.paragraph',
        'blocks.profile',
        'blocks.profile-grid',
        'blocks.blockquote',
        'blocks.callout-text',
        'blocks.cta-strip',
        'blocks.pdf-embed',
        'blocks.video-embed'
      ]
    > &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    hero: Schema.Attribute.Component<'shared.hero', false> &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    locale: Schema.Attribute.String
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::summit-page.summit-page'
    >
    pathSlug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true
        }
      }>
    publishedAt: Schema.Attribute.DateTime
    seo: Schema.Attribute.Component<'shared.seo', false> &
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
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases'
  info: {
    displayName: 'Release'
    pluralName: 'releases'
    singularName: 'release'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String & Schema.Attribute.Required
    publishedAt: Schema.Attribute.DateTime
    releasedAt: Schema.Attribute.DateTime
    scheduledAt: Schema.Attribute.DateTime
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required
    timezone: Schema.Attribute.String
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions'
  info: {
    displayName: 'Release Action'
    pluralName: 'release-actions'
    singularName: 'release-action'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    entryDocumentId: Schema.Attribute.String
    isEntryValid: Schema.Attribute.Boolean
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale'
  info: {
    collectionName: 'locales'
    description: ''
    displayName: 'Locale'
    pluralName: 'locales'
    singularName: 'locale'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50
          min: 1
        },
        number
      >
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface PluginRecordLockingOpenEntity
  extends Struct.CollectionTypeSchema {
  collectionName: 'open-entity'
  info: {
    description: 'List of open entities for record locking plugin.'
    displayName: 'Open Entity'
    pluralName: 'open-entities'
    singularName: 'open-entity'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: true
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    connectionId: Schema.Attribute.String
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    entityDocumentId: Schema.Attribute.String
    entityId: Schema.Attribute.String
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::record-locking.open-entity'
    > &
      Schema.Attribute.Private
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    user: Schema.Attribute.String
  }
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows'
  info: {
    description: ''
    displayName: 'Workflow'
    name: 'Workflow'
    pluralName: 'workflows'
    singularName: 'workflow'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    publishedAt: Schema.Attribute.DateTime
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages'
  info: {
    description: ''
    displayName: 'Stages'
    name: 'Workflow Stage'
    pluralName: 'workflow-stages'
    singularName: 'workflow-stage'
  }
  options: {
    draftAndPublish: false
    version: '1.1.0'
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >
  }
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files'
  info: {
    description: ''
    displayName: 'File'
    pluralName: 'files'
    singularName: 'file'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    alternativeText: Schema.Attribute.Text
    caption: Schema.Attribute.Text
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    ext: Schema.Attribute.String
    focalPoint: Schema.Attribute.JSON
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    formats: Schema.Attribute.JSON
    hash: Schema.Attribute.String & Schema.Attribute.Required
    height: Schema.Attribute.Integer
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private
    mime: Schema.Attribute.String & Schema.Attribute.Required
    name: Schema.Attribute.String & Schema.Attribute.Required
    previewUrl: Schema.Attribute.Text
    provider: Schema.Attribute.String & Schema.Attribute.Required
    provider_metadata: Schema.Attribute.JSON
    publishedAt: Schema.Attribute.DateTime
    related: Schema.Attribute.Relation<'morphToMany'>
    size: Schema.Attribute.Decimal & Schema.Attribute.Required
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    url: Schema.Attribute.Text & Schema.Attribute.Required
    width: Schema.Attribute.Integer
  }
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders'
  info: {
    displayName: 'Folder'
    pluralName: 'folders'
    singularName: 'folder'
  }
  options: {
    draftAndPublish: false
  }
  pluginOptions: {
    'content-manager': {
      visible: false
    }
    'content-type-builder': {
      visible: false
    }
  }
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>
    createdAt: Schema.Attribute.DateTime
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>
    locale: Schema.Attribute.String & Schema.Attribute.Private
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1
      }>
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique
    publishedAt: Schema.Attribute.DateTime
    updatedAt: Schema.Attribute.DateTime
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private
  }
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken
      'admin::api-token-permission': AdminApiTokenPermission
      'admin::permission': AdminPermission
      'admin::role': AdminRole
      'admin::session': AdminSession
      'admin::transfer-token': AdminTransferToken
      'admin::transfer-token-permission': AdminTransferTokenPermission
      'admin::user': AdminUser
      'api::foundation-blog-post.foundation-blog-post': ApiFoundationBlogPostFoundationBlogPost
      'api::foundation-navigation.foundation-navigation': ApiFoundationNavigationFoundationNavigation
      'api::foundation-page.foundation-page': ApiFoundationPageFoundationPage
      'api::grant-overview-page.grant-overview-page': ApiGrantOverviewPageGrantOverviewPage
      'api::grant-page.grant-page': ApiGrantPageGrantPage
      'api::profile-page.profile-page': ApiProfilePageProfilePage
      'api::report.report': ApiReportReport
      'api::summit-navigation.summit-navigation': ApiSummitNavigationSummitNavigation
      'api::summit-page.summit-page': ApiSummitPageSummitPage
      'plugin::content-releases.release': PluginContentReleasesRelease
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction
      'plugin::i18n.locale': PluginI18NLocale
      'plugin::record-locking.open-entity': PluginRecordLockingOpenEntity
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage
      'plugin::upload.file': PluginUploadFile
      'plugin::upload.folder': PluginUploadFolder
    }
  }
}
