import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriorityLevel } from '@prisma/client';

export interface AiVerifyEvidencePayload {
  complaintId: string;
  complaintCategory: string;
  complaintDescription: string;
  imageUrl: string;
}

export interface AiVerifyEvidenceResult {
  is_relevant: boolean | null;
  matches_category: boolean | null;
  confidence_score: number;
  detected_objects: string[];
  quality_flags: string[];
  reasoning: string;
  recommendation: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'AUTO_FLAG';
}

export interface CategoryItem {
  id: string;
  name: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  handled_categories: string[];
}

export interface AiRouteComplaintPayload {
  complaintId: string;
  title: string;
  description: string;
  citizenSelectedCategory?: string | null;
  availableCategories: CategoryItem[];
  availableDepartments: DepartmentItem[];
}

export interface AiRouteComplaintResult {
  suggested_category_id: string;
  suggested_department_id: string;
  suggested_priority: PriorityLevel;
  confidence_score: number;
  category_changed_from_citizen: boolean;
  reasoning: string;
  routing_decision: 'AUTO_ROUTE' | 'SUGGEST_ONLY' | 'MANUAL_TRIAGE';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Calls the FastAPI AI service /ai/verify-evidence endpoint with graceful fallback.
   */
  async verifyEvidence(
    payload: AiVerifyEvidencePayload,
  ): Promise<AiVerifyEvidenceResult> {
    const baseUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      this.configService.get<string>('app.aiServiceUrl') ||
      'http://localhost:8000';

    const endpoint = `${baseUrl.replace(/\/$/, '')}/ai/verify-evidence`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    try {
      this.logger.log(
        `Sending evidence verification request for complaint ${payload.complaintId} to AI service at ${endpoint}`,
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          complaint_id: payload.complaintId,
          complaint_category: payload.complaintCategory,
          complaint_description: payload.complaintDescription,
          image_url: payload.imageUrl,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `AI Service returned non-200 status (${response.status}): ${errorText}`,
        );
        return this.getEvidenceFallbackResult('AI service returned non-OK HTTP status');
      }

      const data: AiVerifyEvidenceResult = await response.json();
      this.logger.log(
        `Received AI verification result for complaint ${payload.complaintId}: recommendation=${data.recommendation}, score=${data.confidence_score}`,
      );
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const isTimeout = error.name === 'AbortError';
      this.logger.warn(
        `AI Service call failed (${isTimeout ? 'Timeout 15s' : error.message}). Falling back to safe default.`,
      );
      return this.getEvidenceFallbackResult(
        isTimeout
          ? 'AI verification request timed out after 15 seconds'
          : `AI Service unavailable: ${error.message}`,
      );
    }
  }

  /**
   * Calls the FastAPI AI service /ai/route-complaint endpoint with graceful fallback.
   */
  async routeComplaint(
    payload: AiRouteComplaintPayload,
  ): Promise<AiRouteComplaintResult> {
    const baseUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      this.configService.get<string>('app.aiServiceUrl') ||
      'http://localhost:8000';

    const endpoint = `${baseUrl.replace(/\/$/, '')}/ai/route-complaint`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    try {
      this.logger.log(
        `Sending complaint routing request for complaint ${payload.complaintId} to AI service at ${endpoint}`,
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          complaint_id: payload.complaintId,
          title: payload.title,
          description: payload.description,
          citizen_selected_category: payload.citizenSelectedCategory || null,
          available_categories: payload.availableCategories,
          available_departments: payload.availableDepartments,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `AI Service returned non-200 status (${response.status}): ${errorText}`,
        );
        return this.getRoutingFallbackResult(payload, 'AI service returned non-OK status');
      }

      const data: AiRouteComplaintResult = await response.json();
      this.logger.log(
        `Received AI routing result for complaint ${payload.complaintId}: decision=${data.routing_decision}, score=${data.confidence_score}`,
      );
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const isTimeout = error.name === 'AbortError';
      this.logger.warn(
        `AI Routing call failed (${isTimeout ? 'Timeout 15s' : error.message}). Falling back to safe default.`,
      );
      return this.getRoutingFallbackResult(
        payload,
        isTimeout
          ? 'AI routing request timed out after 15 seconds'
          : `AI Service unavailable: ${error.message}`,
      );
    }
  }

  private getEvidenceFallbackResult(reason: string): AiVerifyEvidenceResult {
    return {
      is_relevant: null,
      matches_category: null,
      confidence_score: 0.5,
      detected_objects: [],
      quality_flags: ['PENDING_AI_REVIEW'],
      reasoning: `AI service offline/unreachable (${reason}); flagged for manual review.`,
      recommendation: 'MANUAL_REVIEW',
    };
  }

  private getRoutingFallbackResult(
    payload: AiRouteComplaintPayload,
    reason: string,
  ): AiRouteComplaintResult {
    const fallbackCat =
      payload.citizenSelectedCategory || payload.availableCategories[0]?.id || '';
    const fallbackDept = payload.availableDepartments[0]?.id || '';

    return {
      suggested_category_id: fallbackCat,
      suggested_department_id: fallbackDept,
      suggested_priority: PriorityLevel.MEDIUM,
      confidence_score: 0.0,
      category_changed_from_citizen: false,
      reasoning: `AI routing offline/unreachable (${reason}); flagged for manual admin triage.`,
      routing_decision: 'MANUAL_TRIAGE',
    };
  }
}
