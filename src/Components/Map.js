import React, { useEffect, useState } from 'react';
import ReactDOMServer from 'react-dom/server';

import axios from 'axios';

import { Icon } from '@mdi/react';
import { mdiFilterOutline, mdiCogOutline, mdiInformationSlabCircle, mdiOpenInNew, mdiHelpCircle } from '@mdi/js';

import { Card, Container, Row, Col, Accordion, Button, Form, Popover, OverlayTrigger, Placeholder } from 'react-bootstrap';
import Spinner from 'react-bootstrap/Spinner';

import { Animate, AnimateKeyframes, AnimateGroup } from "react-simple-animate";

import { MultiSelect } from 'react-multi-select-component';

import { MapContainer, GeoJSON, LayerGroup, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import getCountryISO2 from 'country-iso-3-to-2';
import ReactCountryFlag from 'react-country-flag';

import * as allCountries from '../data/countries.geo.json';
import * as africanCountries from '../data/african-countries.json';
import * as centroids from '../data/centroids.geo.json';

import BarChart from './BarChart';
import countryIso3To2 from 'country-iso-3-to-2';
import { filter, geoConicEquidistantRaw } from 'd3';

import logo from '../aorai.svg';



function Map() {
    const api = {
        base_url: 'https://nocodb.openup.org.za/api/v1/db/data/v1/AORAI2'
    }
    const [loading, setLoading] = useState(true);
    const [loadingText, setLoadingText] = useState('Loading...');
    const [yearsLoading, setYearsLoading] = useState(false);
    const [policyAreasLoading, setPolicyAreasLoading] = useState(false);
    const [position, setPosition] = useState([-7, 22]);
    const [policyAreas, setPolicyAreas] = useState([]);
    const [selectedPolicyAreas, setSelectedPolicyAreas] = useState([]);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [selectedYears, setSelectedYears] = useState([1960,2023]);
    const [types, setTypes] = useState([
        ['Law, standard, code or treaty','treaty'],
        ['Policy, strategy, plan or guideline','strategy'],
        ['Report, database or tool','report'],
        ['Organisation or project','organisation'],
        ['Unknown/ Not applicable','unknown']
    ]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [activePolicyAreas, setActivePolicyAreas] = useState([]);
    const [activeYears, setActiveYears] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [refreshMap, setRefreshMap] = useState(1);
    const [showSection, setShowSection] = useState('map');
    const [regions, setRegions] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('');
    const [aiDirect, setAiDirect] = useState(false);

    useEffect(() => {

        getPolicies();
        getPolicyAreas();
        getRegions();
        
        
    }, []);

    const getPolicies = () => {

        let countryWhere = '';
        let policyAreaWhere = '';

        let yearsArray = [];
        for (let year = selectedYears[0]; year <= selectedYears[1]; year++) {
            if(year == 1999) {
                for (let yr = 1960; yr <= 1999; yr++) {
                    yearsArray.push(yr);
                }
            } else {
                yearsArray.push(year);
            }
        }

    
        
        let dateWhere = '(Year,in,' + yearsArray.join(',') + ')';

        if(selectedCountries.length) {
            countryWhere = '(Country,in,' + selectedCountries.join(',') + ')';
        }
        if (selectedPolicyAreas.length) {
            policyAreaWhere = '((Observatory AI policy areas - primary,in,' + selectedPolicyAreas.join(',') + ')~or(Observatory AI policy areas - secondary,in,' + selectedPolicyAreas.join(',') + '))';
        }

        let where = '';
        if (countryWhere != '' && policyAreaWhere != '') {
            where = dateWhere + '~and(Country,isnot,null)~and' + countryWhere + '~and' + policyAreaWhere;
        } else if (countryWhere == '' && policyAreaWhere == '') {
            where = dateWhere + '~and(Country,isnot,null)';
        } else {
            where = dateWhere + '~and(Country,isnot,null)~and' + countryWhere + policyAreaWhere;
        }

        where = where + '~and(Analysis status,eq,Publish to website)';

        if(aiDirect) {
            where = where + '~and(AI reference,eq,Direct)';
        }

        if(selectedTypes.length) {

            let typeWhere = '';

            for (let i = 0; i < selectedTypes.length; i++) {
                if(typeWhere != '') {
                    typeWhere = typeWhere + '~or(Policy or governance type,like,%' + selectedTypes[i] + '%)';
                } else {
                    typeWhere = '(Policy or governance type,like,%' + selectedTypes[i] + '%)';
                }
            }

            where = where + '~and(' + typeWhere + ')';
        
        }


        

        axios.get(api.base_url + '/Policy and Governance Map', {
            headers: {
                'xc-token': process.env.API_KEY
            },
            params: {
                limit: 150,
                fields: 'Original title,English title,External URL,Country,Year,Analysis status,Observatory AI policy areas - primary,Observatory AI policy areas - secondary,Featured policy and governance,AI reference,Policy or governance type',
                'nested[Country][fields]': 'Country name,Country code',
                where: where
            }
        }).then(function(response) {




            let queries = [];

            for (let count = 0; count < Math.ceil(response.data.pageInfo.totalRows / 150); count++) {
                let offset = count > 0 ? '?offset=' + (count * 150) : '';
                queries.push(api.base_url + '/Policy and Governance Map' + offset);
            }

            let queries_get = [];

            for (let query = 0; query < queries.length; query++) {
                
                queries_get.push(axios.get(queries[query], { 
                    headers: {
                        'xc-token': process.env.API_KEY
                    },
                    params: {
                        limit: 150,
                        fields: 'Original title,English title,External URL,Country,Year,Analysis status,Observatory AI policy areas - primary,Observatory AI policy areas - secondary,Featured policy and governance,AI reference,Policy or governance type',
                        'nested[Country][fields]': 'Country name,Country code',
                        where: where
                    }
                }))

            }

            axios.all(queries_get).then(axios.spread((...responses) => {

                let policiesData = [];

                for (let count = 0; count < responses.length; count++) {
                    let response = responses[count];
                    policiesData = policiesData.concat(response.data.list);
                }

                let policiesDataTransformed = policiesData.reduce((r, a) => {
                    r[a.Country[0]['Country code']] = [...r[a.Country[0]['Country code']] || [], a];
                    return r;
                }, {});

                for (let count = 0; count < africanCountries.length; count++) {
                    let country = africanCountries[count];
                    if (!policiesDataTransformed[country.iso_code]) {
                        policiesDataTransformed[country.iso_code] = [];
                    }
                }

                let policiesDataTransformedSorted = {};
                Object.keys(policiesDataTransformed).sort().forEach(function(key) {
                    policiesDataTransformedSorted[key] = policiesDataTransformed[key];

                    // order by year
                    policiesDataTransformedSorted[key].sort(function(a, b) {
                        var nameA = a.Year[0].Year.toUpperCase();
                        var nameB = b.Year[0].Year.toUpperCase(); 
                        if (nameA < nameB) {
                            return -1;
                        }
                        if (nameA > nameB) {
                        return 1;
                        }
                    });


                });



                setFilteredData(policiesDataTransformedSorted);
                setLoading(false);
                setYearsLoading(false);
                setPolicyAreasLoading(false);

                
            })).catch(error => {
                console.log(error);
            })

        })


    }

    const getPolicyAreas = () => {

        axios.get(api.base_url + '/Observatory AI policy areas', {
            headers: {
                'xc-token': process.env.API_KEY
            }
        }).then(function(response) {

            // order by name
            response.data.list.sort(function(a, b) {
                var nameA = a['Policy area'].toUpperCase();
                var nameB = b['Policy area'].toUpperCase(); 
                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                return 1;
                }
            });
            


            setPolicyAreas(response.data.list);
        })
    
    }

    const getRegions = () => {

        let regions_temp = [];

        axios.get(api.base_url + '/Regional grouping - geo', {
            headers: {
                'xc-token': process.env.API_KEY
            },
            params: {
                limit: 250,
                where: '(Country,isnot,null)'
            }
        }).then(function(response) {

            regions_temp = response.data.list;

            axios.get(api.base_url + '/Regional grouping - income', {
                headers: {
                    'xc-token': process.env.API_KEY
                },
                params: {
                    limit: 250,
                    where: '(Country,isnot,null)'
                }
            }).then(function(response) {
                regions_temp = regions_temp.concat(response.data.list);

                setRegions(regions_temp);
                

            })

        })

    }

    useEffect(() => {

        setPolicyAreasLoading(true);
        setYearsLoading(true);
        getPolicies();

    }, [selectedPolicyAreas, selectedCountries, selectedYears, selectedRegion, aiDirect, selectedTypes]);


    const getPolicyCount = (iso_code) => {

        if(filteredData[iso_code]) {
            return filteredData[iso_code].length;
        } else {
            return '-';
        }

    }

    const selectPolicyArea = (e) => {

        let policy = e.target.value;
        let checked = e.target.checked;

        if (policy == 'all') {
            if (checked) {
                setSelectedPolicyAreas([]);
            } 
        } else {

            if (checked) {
                setSelectedPolicyAreas([...selectedPolicyAreas, policy]);
            } else {
                setSelectedPolicyAreas(selectedPolicyAreas.filter((item) => item !== policy));
            }
        }
    }

    const selectCountry = (e) => {

        let country = e.target.value;
        let checked = e.target.checked;

        if(country == 'all') {
            if (checked) {
                setSelectedCountries([]);
            }
        } else {

            if (checked) {
                setSelectedCountries([...selectedCountries, country]);
            } else {
                setSelectedCountries(selectedCountries.filter((item) => item !== country));
            }
        }

        setSelectedRegion('');

    }

    const selectYear = (e, startEnd) => {
        
        let year = e.target.value;

        if (startEnd == 'start') {
            setSelectedYears([year, selectedYears[1]]);
        } else {
            if(year < selectedYears[0]) {
                setSelectedYears([year,selectedYears[0]]);
            } else {
                setSelectedYears([selectedYears[0],year]);
            }
        }

    }

    const selectRegion = (e) => {
            
        let region = e.target.value;
        setSelectedRegion(region);

        let region_countries = [];

        regions.filter(reg => reg['Region name'] == region).forEach(regio => {

            regio.Country.forEach(country => {
                region_countries.push(country['Country name']);
            })


        })

        setSelectedCountries(region_countries);
    
    }

    const selectType = (e) => {

        let type = e.target.value;
        let checked = e.target.checked;

        if (type == 'all') {
            if (checked) {
                setSelectedTypes([]);
            }
        } else {
            if (checked) {
                setSelectedTypes([...selectedTypes, type]);
            } else {
                setSelectedTypes(selectedTypes.filter((item) => item !== type));
            }
        }

        
    }

    const toggleAiDirect = () => {

        setAiDirect(!aiDirect);

    }


    const transformFilteredData = () => {

        let policiesData = [];

        Object.keys(filteredData).forEach( key => {

            if(filteredData[key].length) {
                policiesData.push(filteredData[key]);
            }

        })

        policiesData = policiesData.flat();

        setPolicies(policiesData);
        
    
    }


    const itemsCount = (data) => {
        
        let policyCount = 0;

        Object.keys(data).forEach(key=>{
            policyCount += data[key].length;
        })

        return policyCount;

    }

    const toggleAllPolicyAreas = (e) => {

        let checked = e.target.checked;

        if (checked) {
            setSelectedPolicyAreas(policyAreas);
        } else {
            setSelectedPolicyAreas([]);
        }

    }


    const updateTooltips = () => {

        Object.keys(filteredData).forEach(key=>{
            let tooltip = document.getElementById('iso-' + key);
            if (tooltip) {
                tooltip.innerHTML = getPolicyCount(key);
            }
        })

        setRefreshMap(refreshMap + 1);
    }


    useEffect(() => {

        transformFilteredData();
        updateTooltips();
        updateBarChart();

    }, [filteredData]);


    const getMax = (type) => {

        if(type == 'policyAreas') {
            return Math.max.apply(Math, activePolicyAreas.map(function(o) { return o.count; }))
        } else {
            return Math.max.apply(Math, activeYears.map(function(o) { return o.count; }))
        }


    }


    

    const updateBarChart = () => {

        let activePolicyAreas = [];

        if(selectedPolicyAreas.length) {

            // Add all selectedPolicyAreas to the array
            selectedPolicyAreas.forEach((selectedPolicyArea) => {
                activePolicyAreas.push({
                    policy_area: selectedPolicyArea,
                    count: 0
                });
            });

            Object.keys(filteredData).forEach((key)=>{
                filteredData[key].forEach((policy)=>{
                    policy.policyAreas = policy['Observatory AI policy areas - primary'].concat(policy['Observatory AI policy areas - secondary']);
                    policy.policyAreas.forEach((policyArea)=>{
                        activePolicyAreas.forEach((activePolicyArea)=>{
                            if (activePolicyArea.policy_area == policyArea['Policy area']) {
                                activePolicyArea.count++;
                            }
                        });
                    });
                });
            });

            setActivePolicyAreas(activePolicyAreas);
        
        } else {
            setActivePolicyAreas([]);
        }

        let activeYears = [];
        
        activeYears.push({year: 'PRE 2000', count: 0});

        Object.keys(filteredData).forEach((key)=>{

            filteredData[key].forEach((policy)=>{

                policy.Year.forEach((year)=>{
                    if (parseInt(year.Year) < 2000) {
                        let pre2000 = activeYears.find((o) => o.year == 'PRE 2000');
                        pre2000.count++;
                        activeYears = activeYears.filter((o) => o.year != year.Year);
                    } else {
                        if(activeYears.find(yr => yr.year == year.Year) == undefined) {
                            activeYears.push({
                                year: year.Year,
                                count: 1
                            });
                        } else {
                            activeYears.find(yr => yr.year == year.Year).count++;
                        }
                    }
                });
            
            });
        
        });

        activeYears.sort((a,b) => (a.year > b.year) ? 1 : ((b.year > a.year) ? -1 : 0));

        activeYears.unshift(activeYears.pop());

        activeYears = activeYears.filter((o) => o.count > 0);

        setActiveYears(activeYears);

    }

    const setPopupContent = (layer) => {
        let html = ReactDOMServer.renderToString(<><div style={{width: '1.4em', height: '1.4em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block', top: '5px', backgroundColor: '#ccc'}} className="border">
            <ReactCountryFlag 
                countryCode={getCountryISO2(layer.feature.id)}
                svg
                style={{
                    position: 'absolute', 
                    top: '30%',
                    left: '30%',
                    marginTop: '-50%',
                    marginLeft: '-50%',
                    fontSize: '1.8em',
                    lineHeight: '1.8em',
                }} 
            />
        </div>&nbsp;&nbsp;<span className="fw-bold">{layer.feature.properties.name.length > 25 ? layer.feature.properties.name.substring(0,25) + '...' : layer.feature.properties.name}</span>
        <p><span className="fw-bold">{getPolicyCount(layer.feature.id)}</span> {getPolicyCount(layer.feature.id) == 1 ? 'POLICY' : 'POLICIES'}</p>
        
        </>);
        setTimeout(() => {
            document.querySelector('.popup-content').innerHTML = html;
        }, 1000);
    }

    const style = (feature) => {

        const scale = (value) => {
            
            return value < 1 ? '#dfdfdf' :
            value > 0 && value < 11 ? '#dee2e1' :
            value > 10 && value < 21 ? '#bfd4d3' :
            value > 20 && value < 41 ? '#80aaa8' : 
            value > 41 ? '#3c7a77' : '#dfdfdf';

        }

        return {
            fillColor: africanCountries.map(country => country.iso_code).includes(feature.id) ? scale(getPolicyCount(feature.id)) : '#e3e7e5',
            weight: 0.5,
            opacity: 1,
            color: '#fff',
            dashArray: '0',
            fillOpacity: 1,
        };

    }

    const onEachFeature = (feature, layer) => {
        if (feature) {

            if (africanCountries.map(country => country.iso_code).includes(feature.id)) {
                layer.bindTooltip(`<div class="country-tooltip"><div class="iso-code">${getCountryISO2(feature.id)}</div></div>`, { permanent: true, direction: "center" });
            }

            // let popupContent = ReactDOMServer.renderToString(<div className="popup-content" style={{width: '200px'}}></div>)

            // layer.bindPopup(popupContent);

        }

        layer.on({
            click: (e) => {
                let layer = e.target;
                layer.setStyle({
                    fillOpacity: 0.6,
                });

                console.log(layer.feature.id);

                let countryCheckbox = document.querySelector(`[data-iso-code="${layer.feature.id}"]`);
                console.log(countryCheckbox);
                countryCheckbox.checked = true;
                setSelectedCountries([layer.feature.properties.name]);
                // setShowSection('list');
            }
        });

        layer.on({
            mouseover: (e) => {
                let layer = e.target;
                layer.setStyle({
                    fillOpacity: 0.6,
                });
            }
        });

        layer.on({
            mouseout: (e) => {
                let layer = e.target;
                layer.setStyle({
                    fillOpacity: 1,
                });
            }
        });
    }

    return (
        
        loading ?

            <div className="position-absolute top-50 start-50 translate-middle text-center">
                <Spinner animation="grow" /><br/>
                <span className="text-uppercase fs-5 fw-bold">{loadingText}</span>
            </div>
        
        :
        
        <div className="policy-map position-relative">
            <AnimateGroup play>
                {
                    showSection == 'map' &&
                        <MapContainer
                            className="map-container"
                            center={position}
                            zoom={4}
                            scrollWheelZoom={false}
                            zoomControl={false}
                        >
                            <LayerGroup>
                                <GeoJSON data={allCountries} style={style} onEachFeature={onEachFeature} refresh={refreshMap}/>
                            </LayerGroup>
                        </MapContainer>
                }
                
                <Container fluid className="controls-overlay py-2 pe-none">
                    <Row className="pe-none">
                        <Col className="pe-auto mt-2" xs={{ order: 1}} md={{order: 0, span: 3}}>

                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={1}>
                                <Card className="shadow-sm border-0 rounded sticky-top mb-2">
                                    <Card.Footer>
                                        <Row>
                                            <Col>
                                                <a href="https://www.africanobservatory.ai/" target="_blank"><img src={logo} style={{width: '100%'}}/></a>
                                            </Col>
                                            <Col><h1 className="fs-6 text-uppercase mb-0 mt-1 text-primary">Policy and Governance Map</h1></Col>
                                        </Row>
                                    </Card.Footer>
                                </Card>
                            </Animate>

                            {/* FILTERS */}
                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={1}>
                                <Card className="shadow-sm border-0 rounded sticky-top">
                                    <Card.Header>
                                        <Icon path={mdiFilterOutline} size={1} /> <span>FILTERS</span>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        <Accordion defaultActiveKey="0" flush>
                                            <Accordion.Item eventKey="0">
                                                <Accordion.Header>POLICY AREAS</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <div className="scrollarea" style={{ height: '250px' }}>
                                                        <Row className="mb-2 p-1 list-item-bg">
                                                            <Col><label>All Policy Areas</label></Col>
                                                            <Col xs="auto">
                                                                <input className="filter-form-control" type="checkbox" value="all" onChange={selectPolicyArea} checked={selectedPolicyAreas.length == 0} />
                                                            </Col>
                                                        </Row>
                                                        {
                                                            policyAreas.map((policy_area, index) => {
                                                                return (
                                                                    <Row key={index} className="mb-2 p-1 list-item-bg">
                                                                        <Col>
                                                                            <label>{policy_area['Policy area']}</label>
                                                                        </Col>
                                                                        <Col xs="auto">
                                                                            <input className="filter-form-control" type="checkbox" value={policy_area['Policy area']} onChange={selectPolicyArea} checked={selectedPolicyAreas.includes(policy_area['Policy area'])} />
                                                                        </Col>
                                                                    </Row>
                                                                )
                                                            })
                                                        }
                                                    </div>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="4">
                                                <Accordion.Header>TYPES</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <div className="scrollarea" style={{ height: '215px' }}>    
                                                        <Row className="mb-2 p-1 list-item-bg">
                                                            <Col>All types</Col>
                                                            <Col xs="auto">
                                                                <input className="filter-form-control" type="checkbox" value="all" onChange={selectType} checked={selectedTypes.length == 0} />
                                                            </Col>
                                                        </Row>
                                                            
                                                        {
                                                            types.map((type, index) => {
                                                                return (
                                                                    <Row key={index} className="mb-2 p-1 list-item-bg">
                                                                        <Col>{type[0]}</Col>
                                                                        <Col xs="auto">
                                                                            <input className="filter-form-control" type="checkbox" value={type[1]} onChange={selectType} checked={selectedTypes.includes(type[1])} />
                                                                        </Col>
                                                                    </Row>
                                                                )
                                                            })   
                                                        }
                                                    </div>


                                                    <Form.Check
                                                        size="lg"
                                                        className="my-2"
                                                        type="switch"
                                                        id="ai-direct"
                                                        label="Direct reference to AI"
                                                        checked={aiDirect}
                                                        onChange={toggleAiDirect}
                                                    />
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            
                                            <Accordion.Item eventKey="1">
                                                <Accordion.Header>COUNTRIES</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <div className="scrollarea" style={{ height: '250px' }}>
                                                        <Row className="mb-2 p-1 list-item-bg">
                                                            <Col><label>All Countries</label></Col>
                                                            <Col xs="auto">
                                                                <input className="filter-form-control" type="checkbox" value="all" onChange={selectCountry} checked={selectedCountries.length == 0} />
                                                            </Col>
                                                        </Row>
                                                        {
                                                            allCountries.features.map((country, index) => {
                                                                if(africanCountries.map(cntry => cntry.iso_code).includes(country.id)) {
                                                                    return (
                                                                        <Row key={index} className="mb-2 p-1 list-item-bg">
                                                                            <Col>
                                                                                <label>
                                                                                    <div style={{width: '1.4em', height: '1.4em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block', top: '5px', backgroundColor: '#ccc'}} className="border">
                                                                                        <ReactCountryFlag 
                                                                                            countryCode={getCountryISO2(country.id)}
                                                                                            svg
                                                                                            style={{
                                                                                                position: 'absolute', 
                                                                                                top: '30%',
                                                                                                left: '30%',
                                                                                                marginTop: '-50%',
                                                                                                marginLeft: '-50%',
                                                                                                fontSize: '1.8em',
                                                                                                lineHeight: '1.8em',
                                                                                            }} 
                                                                                        />
                                                                                    </div>&nbsp;&nbsp;{country.properties.name}
                                                                                </label>
                                                                            </Col>
                                                                            <Col xs="auto">
                                                                                <input className="filter-form-control" data-iso-code={country.id} type="checkbox" value={country.properties.name} onChange={selectCountry} checked={selectedCountries.includes(country.properties.name)} />
                                                                            </Col>
                                                                        </Row>
                                                                    )
                                                                }
                                                            })
                                                        }
                                                    </div>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="2">
                                                <Accordion.Header>REGIONS</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <div className="scrollarea" style={{ height: '250px' }}>
                                                        <Row className="mb-2 p-1 list-item-bg">
                                                            <Col>
                                                                <label>None</label>
                                                            </Col>
                                                            <Col xs="auto">
                                                                <input className="filter-form-control" type="radio" value='' onChange={selectRegion} checked={selectedRegion == ''} />
                                                            </Col>
                                                        </Row>
                                                        {
                                                            regions.map((region, index) => {
                                                                return (
                                                                    <Row key={index} className="mb-2 p-1 list-item-bg">
                                                                        <Col>
                                                                            <label>{region['Region name']}</label>
                                                                        </Col>
                                                                        <Col xs="auto">
                                                                            <input className="filter-form-control" type="radio" value={region['Region name']} onChange={selectRegion} checked={selectedRegion == region['Region name']} />
                                                                        </Col>
                                                                    </Row>
                                                                )
                                                            })
                                                        }
                                                    </div>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="3">
                                                <Accordion.Header>DATE RANGE</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    <Row>
                                                        <Col xs="auto" className="d-flex align-items-center fw-bold">Period:</Col>
                                                        <Col className="pe-0">
                                                            <Form.Select value={selectedYears[0]} className="bg-control-grey" size="sm" onChange={ e => selectYear(e, 'start')}>
                                                            {
                                                                Array.from({ length: 2023 - 1999 + 1 }, (_, i) => i + 1999).map((year) => {
                                                                    return (
                                                                        
                                                                        <option key={year} value={year == 1999 ? 'PRE 2000' : year}>{year == 1999 ? 'PRE 2000' : year}</option>
                                                                    )
                                                                })

                                                            }
                                                            </Form.Select>
                                                        </Col>
                                                        <Col xs="auto" className="d-flex align-items-center px-2">
                                                            TO
                                                        </Col>
                                                        <Col className="ps-0">
                                                            <Form.Select value={selectedYears[1]} className="bg-control-grey" size="sm" onChange={ e => selectYear(e, 'end')}>
                                                            {
                                                                Array.from({ length: 2023 - 2000 + 1 }, (_, i) => i + 2000).map((year) => {
                                                                    return (
                                                                        <option key={year} value={year}>{year}</option>
                                                                    )
                                                                })

                                                            }
                                                            </Form.Select>
                                                        </Col>
                                                    </Row>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        </Accordion>    

                                       
                                
                                    </Card.Body>
                                    <Card.Footer className="py-3">
                                        <Row>
                                            <Col>
                                                <Row>
                                                    <Col>
                                                        <Icon path={mdiHelpCircle} size={0.9} color="#005450" /> <a href="https://bit.ly/PGMMethod" target="_blank" className="text-decoration-none fw-bold">Policy and Governance Map Method&nbsp;<Icon path={mdiOpenInNew} size={0.5} style={{position: 'relative', top: '-2px'}}/></a>
                                                    </Col>
                                                </Row>
                                            </Col>
                                            
                                        </Row>
                                    
                                    </Card.Footer>
                                </Card>
                            </Animate>

                            


                           

                        </Col>
                        <Col className="pe-none" xs={{ order: 0 }} md={{order: 1}}>
                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={0}>
                                <div className="d-flex justify-content-center">
                                    <Card className="shadow-sm border-0 rounded pe-auto">
                                        <Card.Body className="p-2">
                                            <Row>
                                                <Col className="pe-1">
                                                    <Button className="rounded-0 w-100" size="sm" variant={showSection == 'map' ? 'primary' : 'light'} onClick={() => setShowSection('map')}>Map</Button>
                                                </Col>
                                                <Col className="ps-1">
                                                    <Button className="rounded-0 w-100" size="sm" variant={showSection == 'list' ? 'primary' : 'light'}onClick={() => setShowSection('list')}>List</Button>
                                                </Col>
                                            </Row>
                                        </Card.Body>
                                    </Card>
                                </div>
                            </Animate>

                            {
                                showSection == 'list' && 
                                    <Row className="mt-2">
                                        <Col>
                                            <div>
                                                {
                                                    policies.map((item, index) => {
                                                            return (
                                                                <div className="mb-2" key={index}>
                                                                    <Card className="policies-list-item shadow-sm border-0 rounded data-card pe-auto">
                                                                        <Card.Body>
                                                                            <Row key={index} className="mb-2">
                                                                                <Col>
                                                                                    <h4><a href={item['External URL']} target="_blank" title={item['English title'] ? item['English title'] : item['Original title']}>{item['Original title']} <Icon path={mdiOpenInNew} size={0.5} /></a>&nbsp;&nbsp;{
                                                                                        item['Featured policy and governance'] && <a href={item['Featured policy and governance']} className="badge bg-primary text-white">Featured</a>
                                                                                    }</h4>
                                                                                </Col>
                                                                                <Col xs="auto" className="d-flex align-items-center fw-bold">
                                                                                    {
                                                                                        (item.Year.map((year, index) => 
                                                                                            <span key={index}>{year.Year}</span>
                                                                                        ))
                                                                                    }
                                                                                </Col>
                                                                            </Row>
                                                                            <Row>
                                                                                <Col>
                                                                                    {
                                                                                        item['Policy or governance type'] && <span>{item['Policy or governance type']}</span>
                                                                                    }
                                                                                </Col>
                                                                            </Row>
                                                                        </Card.Body>
                                                                        <Card.Footer>
                                                                            <Row>
                                                                                <Col>
                                                                                    {
                                                                                        item['Country'].map((country, index) => {
                                                                                            return (
                                                                                                <div key={index} className="policy-country-label">
                                                                                                    <div style={{width: '1.4em', height: '1.4em', borderRadius: '50%', overflow: 'hidden', position: 'relative', display: 'inline-block', top: '5px', backgroundColor: '#ccc'}} className="border">
                                                                                                        <ReactCountryFlag 
                                                                                                            countryCode={getCountryISO2(country['Country code'])}
                                                                                                            svg
                                                                                                            style={{
                                                                                                                position: 'absolute', 
                                                                                                                top: '30%',
                                                                                                                left: '30%',
                                                                                                                marginTop: '-50%',
                                                                                                                marginLeft: '-50%',
                                                                                                                fontSize: '1.8em',
                                                                                                                lineHeight: '1.8em',
                                                                                                            }} 
                                                                                                        />
                                                                                                    </div>&nbsp;&nbsp;{country['Country name']}
                                                                                                </div>
                                                                                            )
                                                                                        })

                                                                                    }  
                                                                                </Col>
                                                                            </Row>
                                                                            <Row>
                                                                                <Col>
                                                                                    {
                                                                                        item['Observatory AI policy areas - primary'].concat(item['Observatory AI policy areas - secondary']).map((policyArea, index) => {
                                                                                            return (
                                                                                                <div key={index} className="policy-area-label">
                                                                                                { policyArea['Policy area'] }
                                                                                                </div>
                                                                                            )
                                                                                        })
                                                                                    }
                                                                                </Col>
                                                                            </Row>
                                                                        </Card.Footer>
                                                                    </Card>
                                                                </div>
                                                            )
                                                        })
                                                    }
                                            </div>
                                        </Col>
                                    </Row>
                            }

                            
                        
                        </Col>
                        <Col className="pe-auto mt-2" xs={{ order: 2 }} md={{order: 2, span: 3}}>

                            {/* DETAILS */}
                            <Animate start={{ opacity: 0, filter: 'blur(10px)' }} end={{ opacity: 1, filter: 'blur(0)' }} sequenceIndex={3}>
                                <Card className="shadow-sm border-0 rounded data-card">
                                    <Card.Header>
                                        <Icon path={mdiInformationSlabCircle} size={1} /> <span>DETAILS</span>
                                    </Card.Header>

                                    <Card.Body className="p-0">
                                        <Accordion defaultActiveKey={['0','1','2']} flush alwaysOpen>
                                            <Accordion.Item eventKey="0">
                                                <Accordion.Header>HIGHLIGHTS</Accordion.Header>
                                                <Accordion.Body className="px-2 fw-bold">
                                                    <Container>

                                                        <Row className="p-1 list-item-bg">
                                                            <Col>Policy and Governance Items</Col>
                                                            <Col xs="auto">
                                                                {itemsCount(filteredData)}
                                                            </Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>
                                                                {selectedPolicyAreas.length > 0 ?
                                                                    <OverlayTrigger placement="left" overlay={
                                                                        <Popover id="popover-basic">
                                                                            <Popover.Header as="h3">Policy Areas</Popover.Header>
                                                                            <Popover.Body>
                                                                            {
                                                                                selectedPolicyAreas.join(', ')
                                                                            }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }>
                                                                        <span>Policy Areas</span>
                                                                    </OverlayTrigger>
                                                                    : 'Policy Areas'
                                                                }
                                                            </Col>
                                                            <Col xs="auto">{selectedPolicyAreas.length ? selectedPolicyAreas.length : 'All'}</Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>Region</Col>
                                                            <Col xs="auto">{selectedRegion}</Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>Countries</Col>
                                                            <Col xs="auto">
                                                                {
                                                                    selectedCountries.length > 0 ?
                                                                    <OverlayTrigger placement="left" overlay={
                                                                        <Popover id="popover-basic">
                                                                            <Popover.Header as="h3">Countries</Popover.Header>
                                                                            <Popover.Body>
                                                                            {
                                                                                selectedCountries.join(', ')
                                                                            }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }>
                                                                        <span>{selectedCountries.length}</span>
                                                                    </OverlayTrigger>
                                                                    : 'All'
                                                                }
                                                            </Col>
                                                        </Row>
                                                        <Row className="p-1 mt-2 list-item-bg">
                                                            <Col>Period</Col>
                                                            <Col xs="auto">{selectedYears[0]} - {selectedYears[1]}</Col>
                                                        </Row>

                                                        
                                                    
                                                    </Container>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="1">
                                                <Accordion.Header>AI POLICY AREAS</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    {
                                                        policyAreasLoading ? <Placeholder as="p" animation="glow"><Placeholder xs={12} /></Placeholder> :
                                                            activePolicyAreas.length > 0 ?
                                                            <BarChart data={activePolicyAreas} chartid={'all'} field="policy_area" max={getMax('policyAreas')}/>
                                                            : <div className="p-1 text-center no-policies fw-bold">No Policy Areas Selected</div>
                                                    }
                                                </Accordion.Body>
                                            </Accordion.Item>
                                            <Accordion.Item eventKey="2">
                                                <Accordion.Header>PUBLISHING TIMELINE</Accordion.Header>
                                                <Accordion.Body className="px-2">
                                                    {
                                                        yearsLoading ? <Placeholder as="p" animation="glow"><Placeholder xs={12} /></Placeholder> :
                                                        activeYears.length > 0 &&
                                                        <BarChart data={activeYears} chartid={'years'} field="year" max={getMax('years')}/>
                                                    }
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        </Accordion>
                                    </Card.Body>
                                </Card>
                            </Animate>

                        
                        </Col>



                    </Row>
                </Container>
                    

               
               
            </AnimateGroup>
        </div>
    );
}

export default Map;