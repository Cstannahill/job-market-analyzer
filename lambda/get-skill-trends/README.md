# API

/trends
/skill
/{skillName} → GET method → Lambda: get-skill-trends
/region → GET method → Lambda: get-skill-trends
/seniority → GET method → Lambda: get-skill-trends
/technology → GET method → Lambda: get-skill-trends

## Examples

Get Specific Skill
GET /trends/skill/python

Top Skills by Region
GET /trends/region?region=us&limit=10

Query params:
region: us, europe, india, remote, other
limit: number of results (default 10)

Top Skills by Seniority
GET /trends/seniority?level=senior&limit=10

Query params:
level: junior, mid, senior
limit: number of results

Top Technologies
GET /trends/technology?limit=20
Returns top technologies only (filtered by skill_type).

```ts
// src/services/trendsApi.ts
const BASE_API_URL = import.meta.env.VITE_API_URL;

export const getTopSkillsByRegion = async (region: string, limit = 10) => {
  const response = await axios.get(`${BASE_API_URL}/trends/region`, {
    params: { region, limit },
  });
  return response.data.data;
};

export const getTopTechnologies = async (limit = 20) => {
  const response = await axios.get(`${BASE_API_URL}/trends/technology`, {
    params: { limit },
  });
  return response.data.data;
};

export const getSkillDetails = async (skillName: string) => {
  const response = await axios.get(`${BASE_API_URL}/trends/skill/${skillName}`);
  return response.data.data;
};
```

# Returns

https://xee5kjisf5.execute-api.us-east-1.amazonaws.com/prod/trends/technology?limit=5

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "lastUpdated": "2025-10-06T02:00:05.446Z",
      "remotePercentage": 20,
      "associatedRoles": [],
      "skill": "aws",
      "cooccurringSkills": {
        "terraform": 4,
        "python": 4,
        "ec2": 3,
        "linux": 3,
        "azure": 3
      },
      "count": 10,
      "avgSalary": 279366.6666666667,
      "seniority_level": "senior",
      "relativeDemand": 0.15873015873015872,
      "SK": "region#other#seniority#senior",
      "region": "other",
      "skill_type": "technology",
      "PK": "skill#aws",
      "topIndustries": [
        "Technology Services",
        "Digital Identity Verification",
        "Media/Entertainment Technology"
      ]
    },
    {
      "lastUpdated": "2025-10-06T02:00:05.446Z",
      "remotePercentage": 11.11111111111111,
      "associatedRoles": [],
      "skill": "python",
      "cooccurringSkills": {
        "kubernetes": 3,
        "terraform": 3,
        "aws": 4,
        "javascript": 3,
        "ansible": 3
      },
      "count": 9,
      "avgSalary": 123565.625,
      "seniority_level": "senior",
      "relativeDemand": 0.14285714285714285,
      "SK": "region#other#seniority#senior",
      "region": "other",
      "skill_type": "technology",
      "PK": "skill#python",
      "topIndustries": [
        "Technology Services",
        "insurance",
        "Digital Identity Verification"
      ]
    },
    {
      "lastUpdated": "2025-10-06T02:00:05.446Z",
      "remotePercentage": 25,
      "associatedRoles": [],
      "skill": "javascript",
      "cooccurringSkills": {
        ".net": 2,
        "python": 3,
        "html": 2,
        "java": 2,
        "test-driven development": 3
      },
      "count": 8,
      "avgSalary": 233887.5,
      "seniority_level": "senior",
      "relativeDemand": 0.12698412698412698,
      "SK": "region#other#seniority#senior",
      "region": "other",
      "skill_type": "technology",
      "PK": "skill#javascript",
      "topIndustries": [
        "Technology Services",
        "insurance",
        "Healthcare/Technology"
      ]
    },
    {
      "lastUpdated": "2025-10-06T02:00:05.446Z",
      "remotePercentage": 0,
      "associatedRoles": [],
      "skill": "java",
      "cooccurringSkills": {
        "spring": 1,
        ".net": 1,
        "c++": 3,
        "python": 2,
        "javascript": 2
      },
      "count": 6,
      "avgSalary": 128753.61111111111,
      "seniority_level": "senior",
      "relativeDemand": 0.09523809523809523,
      "SK": "region#other#seniority#senior",
      "region": "other",
      "PK": "skill#java",
      "skill_type": "technology",
      "topIndustries": ["Technology Services", "Technology", "insurance"]
    },
    {
      "lastUpdated": "2025-10-06T02:00:05.446Z",
      "remotePercentage": 0,
      "associatedRoles": [],
      "skill": "terraform",
      "cooccurringSkills": {
        "gitlab": 4,
        "python": 3,
        "aws": 4,
        "eks": 2,
        "ec2": 2
      },
      "count": 5,
      "avgSalary": 205000,
      "seniority_level": "senior",
      "relativeDemand": 0.07936507936507936,
      "SK": "region#other#seniority#senior",
      "region": "other",
      "skill_type": "technology",
      "PK": "skill#terraform",
      "topIndustries": [
        "Digital Identity Verification",
        "Technology Services",
        "EdTech"
      ]
    }
  ]
}
```
