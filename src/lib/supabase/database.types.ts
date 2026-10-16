import type { CompanyFact } from "../memory/contracts";
import type { Strategy, StrategyAction } from "../strategies/contracts";
export type Database = {
  public: {
    Tables: {
      support_requests:{Row:{id:string;user_id:string;company_id:string|null;category:string;description:string;status:string;created_at:string;resolved_at:string|null;severity:string;version:number};Insert:never;Update:never;Relationships:[]};
      legal_documents:{Row:{id:string;kind:string;locale:string;version:string;content:string;approved:boolean;approved_by:string|null;published_at:string};Insert:never;Update:never;Relationships:[]};
      legal_acceptances:{Row:{user_id:string;terms_id:string;privacy_id:string;locale:string;market:string;source:string;accepted_at:string};Insert:never;Update:never;Relationships:[]};
      weekly_intelligence_reports: {Row:{id:string;company_id:string;period_start:string;period_end:string;locale:string;status:string;generated_at:string;structured_report:{report:import("../journal/weekly").Weekly;key_metrics:import("../journal/weekly").Metric[];coverage:{observed_dates:string[]};partial:boolean}};Insert:never;Update:never;Relationships:[]};
      experiments: { Row: import("../experiments/contracts").Experiment; Insert: never; Update: never; Relationships: [] };
      decisions: { Row: import("../decisions/contracts").Decision; Insert: never; Update: never; Relationships: [] };
      strategies: { Row: Strategy; Insert: never; Update: never; Relationships: [] };
      actions: { Row: StrategyAction; Insert: never; Update: never; Relationships: [] };
      company_facts: { Row: CompanyFact; Insert: never; Update: never; Relationships: [] };
      profiles: {
        Row: { id: string; locale: string | null; display_name: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string; created_at?: string; updated_at?: string };
        Update: { display_name?: string; locale?: string };
        Relationships: [];
      };
      companies: {
        Row: { id: string; preferred_language: string | null; locale: string | null; timezone: string | null; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      company_members: {
        Row: { company_id: string; user_id: string; role: "owner" | "member"; created_at: string };
        Insert: { company_id: string; user_id: string; role?: "owner" | "member"; created_at?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { export_private_data:{Args:{p_company:string|null};Returns:unknown}; operations_terms_current:{Args:Record<string,never>;Returns:boolean}; operations_user_allowed: {Args:Record<string,never>;Returns:boolean}; submit_support_request: {Args:{p_company:string|null;p_category:string;p_description:string};Returns:string}; accept_legal_documents:{Args:{p_terms:string;p_privacy:string;p_locale:string};Returns:undefined}; edit_journal_entry: {Args:{p_company:string;p_id:string;p_version:number;p_description:string;p_value:number|null;p_delete:boolean};Returns:undefined}; edit_business_memory: { Args: { p_company:string; p_id:string; p_version:number; p_value:string; p_delete:boolean }; Returns: undefined }; save_experiment: { Args: { p_company_id: string; p_id: string; p_draft: import("../experiments/contracts").ExperimentDraft }; Returns: string }; start_experiment: { Args: { p_company_id: string; p_id: string; p_version: number }; Returns: undefined }; finish_experiment: { Args: { p_company_id: string; p_id: string; p_version: number; p_status: string; p_result: string | null; p_learning: string }; Returns: undefined }; save_decision: { Args: { p_company_id: string; p_id: string; p_draft: import("../decisions/contracts").DecisionDraft }; Returns: string }; review_decision: { Args: { p_company_id: string; p_id: string; p_version: number; p_result: string; p_learning: string }; Returns: undefined }; save_strategy: { Args: { p_company_id: string; p_id: string; p_draft: import("../strategies/contracts").StrategyDraft }; Returns: string }; set_strategy_status: { Args: { p_company_id: string; p_id: string; p_status: string; p_version: number }; Returns: undefined }; set_action_status: { Args: { p_company_id: string; p_id: string; p_status: string; p_version: number }; Returns: undefined }; save_company_market: { Args: { p_company_id: string; p_country: string | null; p_currency: string | null; p_preferred_language: string | null; p_locale: string | null; p_timezone: string | null; p_expected_updated_at: string | null; p_country_version: number | null; p_currency_version: number | null }; Returns: undefined }; save_company_fact: { Args: { p_company_id: string; p_key: string; p_value: string; p_expected_version: number | null }; Returns: CompanyFact[] }; create_company: { Args: { company_name: string }; Returns: string } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};




