from __future__ import annotations

from app.prompts.system_prompt import SYSTEM_PROMPT


class TestSystemPrompt:
    def test_prompt_specifies_tools(self):
        assert "search_contacts" in SYSTEM_PROMPT
        assert "get_contact_summary" in SYSTEM_PROMPT
        assert "get_aggregation" in SYSTEM_PROMPT
        assert "get_import_audit" in SYSTEM_PROMPT
        assert "count_temp_emails" in SYSTEM_PROMPT

    def test_prompt_specifies_actions(self):
        assert "view_filtered_list" in SYSTEM_PROMPT
        assert "export_csv" in SYSTEM_PROMPT
        assert "view_contact_profile" in SYSTEM_PROMPT

    def test_prompt_mentions_json_output(self):
        assert "JSON" in SYSTEM_PROMPT