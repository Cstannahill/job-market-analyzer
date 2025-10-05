Indeed Job Search
Returns jobs from Indeed.

Authorizations:
ApiKeyAuth
API Key: ApiKeyAuth
The Outscraper API uses API keys (tokens) to authenticate requests. You can view and manage your API key on the profile page.

Authentication to the API is performed via X-API-KEY: YOUR-API-KEY header inside each request.

Alternatively, you can send the API key inside URL query parameters apiKey=YOUR-API-KEY. Although, this method less secure and recommended for testing purposes only.

Your API keys carry various privileges, do not share them in public areas such as GitHub, client-side code, and so forth.

Header parameter name: X-API-KEY
query Parameters
query
required
Array of strings
Search links with search parameters (e.g., https://www.indeed.com/jobs?q=&l=Fremont+Canyon%2C+CA).

It supports batching by sending arrays with up to 250 queries (e.g., query=text1&query=text2&query=text3). It allows multiple queries to be sent in one request and to save on network latency time.

limit
integer
Default: 100
The parameter specifies the limit of items to get from one query.

enrichment
Array of strings
The parameter defines an enrichment or enrichments (e.g., enrichment=enrichment1&enrichment=enrichment2&enrichment=enrichment3) you want to apply to the results.

Available values:

domains_service — Emails & Contacts Scraper: finds emails, social links, phones, and other contacts from websites,

emails_validator_service — Email Address Verifier: validates emails, checks deliverability, filters out blacklists, spam traps, and complainers, while significantly reducing your bounce rate,

company_websites_finder - Company Website Finder: finds company websites based on business names,

disposable_email_checker — Disposable Emails Checker: checks origins of email addresses (disposable, free, or corporate),

company_insights_service — Company Insights: finds company details such as revenue, size, founding year, public status, etc,

phones_enricher_service — Phone Numbers Enricher: returns phones carrier data (name/type), validates phones, ensures messages deliverability,

trustpilot_service — Trustpilot Scraper: returns data from a list of businesses,

whitepages_phones - Phone Identity Finder: returns insights about phone number owners (name, address, etc.),

ai_chain_info - Chain Info: identifies if a business is part of a chain, adding a true/false indication to your data for smarter targeting.

Using enrichments increases the time of the response. You might want to use the async=true parameter to avoid getting timeouts.

fields
string
The parameter defines which fields you want to include with each item returned in the response. By default, it returns all fields. Use &fields=query,name to return only the specific ones.

async
boolean
Default: "true"
The parameter defines the way you want to submit your task to Outscraper. It can be set to false to open an HTTP connection and keep it open until you got your results, or true (default) to just submit your requests to Outscraper and retrieve them later (usually within 1-3 minutes) with the Request Results endpoint. Each response is available for 2 hours after a request has been completed.

A good practice is to send async requests and start checking the results after the estimated execution time. Check out this Python implementation as an example.

As most of the requests take some time to be executed the async=true option is preferred to avoid HTTP requests timeouts.

ui
boolean
Default: "false"
The parameter defines whether a task will be executed as a UI task. This is commonly used when you want to create a regular platform task with API.

Using this parameter overwrites the async parameter to true.

webhook
string
The parameter defines the URL address (callback) to which Outscraper will create a POST request with a JSON body once a task/request is finished.

Using this parameter overwrites the webhook from integrations.

Responses
200 The response contains the status of the request and data. Data is an array where each element represents a response for a single query from the request.
202 The response contains a request ID that can be used to fetch results by using Request Results endpoint. Each response is available for 2 hours after a request has been completed.

## DevNotes

**This Returns**

```json
{
  "id": "your-request-id",
  "status": "Success",
  "data": [
    [
      {
        "query": "https://www.indeed.com/jobs?q=&l=Fremont+Canyon%2C+CA",
        "title": "Secretary I",
        "normTitle": "Secretary",
        "displayTitle": "Secretary I",
        "viewJobLink": "https://indeed.com/viewjob?jk=d2500d00422b0da2&from=vjs&tk=1hto999c4kc0m85e&viewtype=embedded&xkcb=SoCk67M3B4aq6OTWi50BbzkdCdPP&continueUrl=%2Fjobs%3Fq%3D%26l%3DFremont%2BCanyon%252C%2BCA",
        "company": "County of Orange",
        "jobLocationState": "CA",
        "jobLocationCity": "",
        "formattedLocation": "Orange County, CA",
        "remoteLocation": false,
        "createDate": 1714103190000,
        "pubDate": 1714021200000,
        "showJobType": false,
        "salarySnippet": {},
        "snippet": "Screens and answers telephone calls and correspondences.\nOperates multiple telephone lines, computers and applicable peripheral equipment."
      },
      {
        "query": "https://www.indeed.com/jobs?q=&l=Fremont+Canyon%2C+CA",
        "title": "Public Health Investigator Trainee",
        "normTitle": "Public Health Nurse",
        "displayTitle": "Public Health Investigator Trainee",
        "viewJobLink": "https://indeed.com/viewjob?jk=086181c388b409a4&from=vjs&tk=1hto999c4kc0m85e&viewtype=embedded&xkcb=SoAQ67M3B4aq6OTWi50AbzkdCdPP&continueUrl=%2Fjobs%3Fq%3D%26l%3DFremont%2BCanyon%252C%2BCA",
        "company": "County of Orange",
        "jobLocationState": "CA",
        "jobLocationCity": "",
        "formattedLocation": "Orange County, CA",
        "remoteLocation": false,
        "createDate": 1715226363000,
        "pubDate": 1715144400000,
        "showJobType": false,
        "salarySnippet": {},
        "snippet": "Exercising appropriate judgment in answering questions and releasing information; analyzing and projecting consequences of decisions and/or recommendations."
      }
      //...more items
    ]
  ]
}
```

- Fetch the job posting URL from the `viewJobLink` field.
- Use Cheerio to parse the HTML in in the element (div) class="jobsearch-JobComponent-description"
- Extract and clean the text content from that element.
- Add the cleaned text content to a new field called `contents` in the corresponding job posting object.
