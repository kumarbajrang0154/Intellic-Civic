import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required in environment variables',
  }),
  JWT_SECRET: Joi.string().required().messages({
    'any.required': 'JWT_SECRET is required in environment variables',
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().allow('').optional(),
  OTP_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  OTP_PROVIDER_SENDER_ID: Joi.string().allow('').optional(),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  PORT: Joi.number().default(4000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
});
