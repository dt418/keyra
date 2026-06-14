export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Keyra API',
    version: '0.1.0',
    description: 'Modern licensing for modern software - REST API',
    contact: {
      name: 'Keyra',
      url: 'https://github.com/dt418/keyra',
    },
  },
  servers: [
    { url: 'http://localhost:8788', description: 'Local development' },
    { url: 'https://api.keyra.dev', description: 'Production' },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Users', description: 'User management' },
    { name: 'Organizations', description: 'Organization management' },
    { name: 'Products', description: 'Product management' },
    { name: 'Licenses', description: 'License management' },
    { name: 'Activations', description: 'Device activations' },
    { name: 'Verify', description: 'License verification' },
    { name: 'Devices', description: 'Device management' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      License: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          product_id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['trial', 'free', 'personal', 'professional', 'business', 'enterprise'] },
          status: { type: 'string', enum: ['active', 'revoked', 'expired', 'transferred'] },
          max_devices: { type: 'integer' },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          feature_flags: { type: 'object', nullable: true },
        },
      },
      Activation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          license_id: { type: 'string', format: 'uuid' },
          device_id: { type: 'string', format: 'uuid' },
          device_name: { type: 'string' },
          device_platform: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          cursor: { type: 'string', nullable: true },
          has_more: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    timestamp: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        access_token: { type: 'string' },
                        refresh_token: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        access_token: { type: 'string' },
                        refresh_token: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current session',
        responses: {
          '200': { description: 'Logged out' },
          '401': { description: 'Not authenticated' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: { refresh_token: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Token refreshed' },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user',
        responses: {
          '200': {
            description: 'Current user',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } },
              },
            },
          },
          '401': { description: 'Not authenticated' },
        },
      },
    },
    '/api/v1/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List user organizations',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List of organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Organization' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  slug: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Organization created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Organization' } } },
              },
            },
          },
        },
      },
    },
    '/api/v1/organizations/{id}': {
      get: {
        tags: ['Organizations'],
        summary: 'Get organization by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Organization', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Organization' } } } } } },
          '404': { description: 'Not found' },
        },
      },
      patch: {
        tags: ['Organizations'],
        summary: 'Update organization',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Organizations'],
        summary: 'Delete organization',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/api/v1/products': {
      get: {
        tags: ['Products'],
        summary: 'List products',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List of products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create product',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Product created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        api_key: { type: 'string', description: 'API key - shown only on creation' },
                      },
                    },
                  },
                },
              },
            },
          },
          '403': { description: 'Admin or owner role required' },
        },
      },
    },
    '/api/v1/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Products'],
        summary: 'Update product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/api/v1/products/{id}/api-key': {
      get: {
        tags: ['Products'],
        summary: 'Get/regenerate API key for product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'API key',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        apiKey: { type: 'string' },
                        productId: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/products/{id}/regenerate-key': {
      post: {
        tags: ['Products'],
        summary: 'Regenerate API key',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'New API key' } },
      },
    },
    '/api/v1/licenses': {
      get: {
        tags: ['Licenses'],
        summary: 'List licenses',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'product_id', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'revoked', 'expired'] } },
        ],
        responses: { '200': { description: 'List of licenses' } },
      },
      post: {
        tags: ['Licenses'],
        summary: 'Create license',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_id', 'type'],
                properties: {
                  product_id: { type: 'string' },
                  type: { type: 'string', enum: ['trial', 'free', 'personal', 'professional', 'business', 'enterprise'] },
                  max_devices: { type: 'integer', default: 1, maximum: 100 },
                  expires_at: { type: 'string', format: 'date-time' },
                  feature_flags: { type: 'object', additionalProperties: { type: 'boolean' } },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'License created with key' } },
      },
    },
    '/api/v1/licenses/{id}': {
      get: { tags: ['Licenses'], summary: 'Get license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'License' } } },
      patch: { tags: ['Licenses'], summary: 'Update license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
    },
    '/api/v1/licenses/{id}/revoke': {
      post: {
        tags: ['Licenses'],
        summary: 'Revoke a license',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { reason: { type: 'string', maxLength: 500 } },
              },
            },
          },
        },
        responses: { '200': { description: 'Revoked' } },
      },
    },
    '/api/v1/licenses/{id}/reset-devices': {
      post: {
        tags: ['Licenses'],
        summary: 'Reset all device activations for a license',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Devices reset' } },
      },
    },
    '/api/v1/licenses/{id}/transfer': {
      post: {
        tags: ['Licenses'],
        summary: 'Transfer license to another organization',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['target_org_id'],
                properties: { target_org_id: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Transferred' } },
      },
    },
    '/api/v1/activations': {
      get: {
        tags: ['Activations'],
        summary: 'List activations',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'license_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'List of activations' } },
      },
    },
    '/api/v1/activate': {
      post: {
        tags: ['Activations'],
        summary: 'Activate a device for a license',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['license_key', 'device_name', 'platform'],
                properties: {
                  license_key: { type: 'string' },
                  device_name: { type: 'string' },
                  platform: { type: 'string', enum: ['windows', 'linux', 'macos', 'ios', 'android'] },
                  app_version: { type: 'string' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Device activated' }, '403': { description: 'License inactive' }, '404': { description: 'Invalid key' } },
      },
    },
    '/api/v1/verify': {
      post: {
        tags: ['Verify'],
        summary: 'Verify a license key',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['license_key'],
                properties: {
                  license_key: { type: 'string' },
                  device_id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Verification result' } },
      },
    },
    '/api/v1/devices/{id}': {
      delete: {
        tags: ['Devices'],
        summary: 'Deactivate a device',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deactivated' } },
      },
    },
  },
};
